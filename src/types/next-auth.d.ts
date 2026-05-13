// =============================================================
//  src/types/next-auth.d.ts
//  NextAuth.js の Session / JWT 型を拡張
//  企業コード・ユーザー名・ロール等をセッションに追加
// =============================================================

import type { DefaultSession, DefaultJWT } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      userId: string           // ログインID
      userName: string         // 表示名
      chargeName: string       // 担当者名
      companyCode: string      // 企業コード（5桁）
      customerName: string     // 企業名
      role: number             // 権限ロール（0-5）
      sessionTimeoutMin: number // タイムアウト（分）
    } & DefaultSession["user"]
  }

  interface User {
    userId: string
    userName: string
    chargeName: string
    companyCode: string
    customerName: string
    role: number
    sessionTimeoutMin: number
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    userId: string
    userName: string
    chargeName: string
    companyCode: string
    customerName: string
    role: number
    sessionTimeoutMin: number
  }
}
