// =============================================================
//  src/lib/auth.ts  （確定版 v3 — 実スキーマ完全準拠）
//
//  LoginHistory 実フィールド（DB設計書 DB_DESIGN_20260513.md より）:
//    userId(FK→User.id), customerCode, loginAt(auto), ipAddress,
//    userAgent, sessionId, result(Int: 1=成功/-1〜-99=失敗), failReason, loginMethod
//    ※ userName / success / failureReason フィールドは存在しない
//
//  SecurityLog 実フィールド:
//    eventType, message, ipAddress, username, logLevel
//    ※ companyCode / severity フィールドは存在しない → logLevel に統合
//
//  User 実フィールド:
//    username, passwordHash, chargeName, userStatus(1=有効),
//    accountLocked, userRole, customerId
//
//  Customer 実フィールド:
//    customerCode(6桁), customerName, loginEnabled, sessionTimeoutMin
// =============================================================

import NextAuth from "next-auth"
import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "./prisma"

// ------------------------------------------------------------------
// 入力バリデーション
// ------------------------------------------------------------------
const loginSchema = z.object({
  companyCode: z
    .string()
    .regex(/^\d{5}$/, "企業コードは5桁の数字で入力してください"),
  userId: z
    .string()
    .min(1, "ユーザーIDを入力してください")
    .max(50)
    .regex(/^[\x21-\x7E]+$/, "ユーザーIDは半角英数字・記号のみ"),
  password: z.string().min(1, "パスワードを入力してください").max(50),
})

// ------------------------------------------------------------------
// ログイン履歴記録
//
// LoginHistory フィールド:
//   userId(String, FK→User.id), customerCode(String),
//   ipAddress(String), userAgent(String?), sessionId(String?),
//   result(Int: 1=成功, -1〜-99=失敗), failReason(String?), loginMethod(String?)
//
// ★ userId は User.id（UUID）が必要なため、DB参照できない場合は
//    スキップする（ログ記録失敗は認証フローを止めない）
// ------------------------------------------------------------------
async function recordLoginHistory(params: {
  userId: string | null   // User.id（UUID）。未確定の場合は null でスキップ
  customerCode: string
  ipAddress: string
  userAgent: string
  result: number          // 1=成功, -1=PW不一致, -2=ロック, -3=企業無効, -4=企業不一致
  failReason?: string
}) {
  if (!params.userId) return  // userId が取れない場合はスキップ
  try {
    await prisma.loginHistory.create({
      data: {
        userId: params.userId,
        customerCode: params.customerCode,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        result: params.result,
        failReason: params.failReason ?? null,
        loginMethod: "password",
      },
    })
  } catch (err) {
    console.error("[AUTH] LoginHistory 記録エラー:", err)
  }
}

// ------------------------------------------------------------------
// セキュリティログ記録
//
// SecurityLog フィールド:
//   eventType(String), message(String), ipAddress(String?),
//   username(String?), logLevel(String: DEBUG/INFO/WARNING/ERROR/ALERT)
//
// ★ companyCode / severity は存在しない
//    → message に企業コードを含める、severity → logLevel に統合
// ------------------------------------------------------------------
async function recordSecurityLog(params: {
  eventType: string
  message: string
  ipAddress: string
  username?: string
  logLevel?: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "ALERT"
}) {
  try {
    await prisma.securityLog.create({
      data: {
        eventType: params.eventType,
        message: params.message,
        ipAddress: params.ipAddress,
        username: params.username ?? null,
        logLevel: params.logLevel ?? "INFO",
      },
    })
  } catch (err) {
    console.error("[AUTH] SecurityLog 記録エラー:", err)
  }
}

// ------------------------------------------------------------------
// NextAuth 設定
// ------------------------------------------------------------------
export const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
    maxAge: 140 * 60,
  },
  jwt: {
    maxAge: 140 * 60,  // 15*60→140*60 (sessionTimeoutMinに合わせる)
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        companyCode: { label: "企業コード", type: "text" },
        userId: { label: "ユーザーID", type: "text" },
        password: { label: "パスワード", type: "password" },
      },

      async authorize(credentials, request) {
        const ipAddress =
          request.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers?.get("x-real-ip") ??
          "unknown"
        const userAgent = request.headers?.get("user-agent") ?? "unknown"

        // ① 入力バリデーション
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) {
          await recordSecurityLog({
            eventType: "Login_Failure",
            message: `バリデーションエラー [companyCode=${credentials?.companyCode ?? ""}]: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
            ipAddress,
            logLevel: "WARNING",
          })
          return null
        }
        const { companyCode, userId, password } = parsed.data

        // ② 企業確認
        // customerCode は 6桁（例: "000010"）、companyCode は 5桁入力
        // startsWith で前方一致マッチ
        const customer = await prisma.customer.findFirst({
          where: {
            customerCode: { startsWith: companyCode },
            isDeleted: false,
          },
          select: {
            id: true,
            customerCode: true,
            customerName: true,
            loginEnabled: true,
            sessionTimeoutMin: true,
          },
        })

        if (!customer) {
          await recordSecurityLog({
            eventType: "Login_Failure",
            message: `企業コード不一致: companyCode=${companyCode}`,
            ipAddress,
            username: userId,
            logLevel: "WARNING",
          })
          throw new Error("-4")
        }

        // ③ 企業ログイン許可確認
        if (!customer.loginEnabled) {
          await recordSecurityLog({
            eventType: "Login_CompanyDisabled",
            message: `企業ログイン不許可: customerCode=${customer.customerCode}`,
            ipAddress,
            username: userId,
            logLevel: "WARNING",
          })
          throw new Error("-3")
        }

        // ④ ユーザー確認（username フィールドがログインID）
        const user = await prisma.user.findFirst({
          where: {
            customerId: customer.id,
            username: userId,
            isDeleted: false,
          },
          select: {
            id: true,
            username: true,
            chargeName: true,
            passwordHash: true,
            userStatus: true,
            accountLocked: true,
            userRole: true,
            customer: {
              select: {
                customerCode: true,
                customerName: true,
                sessionTimeoutMin: true,
              },
            },
          },
        })

        if (!user) {
          await recordSecurityLog({
            eventType: "Login_Failure",
            message: `ユーザー不存在: username=${userId}, customerCode=${customer.customerCode}`,
            ipAddress,
            username: userId,
            logLevel: "WARNING",
          })
          throw new Error("-1")
        }

        // ⑤ アカウント有効性確認（userStatus=1 が有効）
        if (user.accountLocked || user.userStatus !== 1) {
          await recordLoginHistory({
            userId: user.id,
            customerCode: customer.customerCode,
            ipAddress,
            userAgent,
            result: -2,
            failReason: "ユーザー無効/ロック",
          })
          await recordSecurityLog({
            eventType: "Login_UserDisabled",
            message: `ユーザー無効/ロック: username=${userId}, customerCode=${customer.customerCode}`,
            ipAddress,
            username: userId,
            logLevel: "WARNING",
          })
          throw new Error("-2")
        }

        // ⑥ パスワード検証（bcrypt コスト12）
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
        if (!isPasswordValid) {
          await recordLoginHistory({
            userId: user.id,
            customerCode: customer.customerCode,
            ipAddress,
            userAgent,
            result: -1,
            failReason: "パスワード不一致",
          })
          await recordSecurityLog({
            eventType: "Login_Failure",
            message: `パスワード不一致: username=${userId}, customerCode=${customer.customerCode}`,
            ipAddress,
            username: userId,
            logLevel: "WARNING",
          })
          throw new Error("-1")
        }

        // ⑦ 成功
        await recordLoginHistory({
          userId: user.id,
          customerCode: customer.customerCode,
          ipAddress,
          userAgent,
          result: 1,
        })
        await recordSecurityLog({
          eventType: "Login_Success",
          message: `ログイン成功: username=${userId}, customerCode=${customer.customerCode}`,
          ipAddress,
          username: userId,
          logLevel: "INFO",
        })

        // ⑧ JWT Claims 用オブジェクトを返す
        return {
          id: user.id,
          userId: user.username,
          userName: user.username,
          chargeName: user.chargeName ?? user.username,
          companyCode: customer.customerCode,
          customerName: customer.customerName,
          role: user.userRole,
          sessionTimeoutMin: customer.sessionTimeoutMin ?? 140,
          customerId: customer.id,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.userId
        token.userName = user.userName
        token.chargeName = user.chargeName
        token.companyCode = user.companyCode
        token.customerName = user.customerName
        token.role = user.role
        token.sessionTimeoutMin = user.sessionTimeoutMin
        token.customerId = user.customerId
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.sub ?? ""
      session.user.userId = token.userId as string
      session.user.userName = token.userName as string
      session.user.chargeName = token.chargeName as string
      session.user.companyCode = token.companyCode as string
      session.user.customerName = token.customerName as string
      session.user.role = token.role as number
      session.user.sessionTimeoutMin = token.sessionTimeoutMin as number
      session.user.customerId = token.customerId as string
      return session
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
