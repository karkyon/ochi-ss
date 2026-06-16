import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

const schema = z.object({
  companyCode: z.string().regex(/^\d{5}$/, "企業コードは5桁"),
  userId:      z.string().min(1).max(50),
  password:    z.string().min(1).max(50),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, code: -99, msg: parsed.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      )
    }
    const { companyCode, userId, password } = parsed.data

    const customer = await prisma.customer.findFirst({
      where: { customerCode: { startsWith: companyCode }, isDeleted: false },
      select: { id: true, loginEnabled: true },
    })
    if (!customer)
      return NextResponse.json({ ok: false, code: -4, msg: "企業コードが正しくありません" })
    if (!customer.loginEnabled)
      return NextResponse.json({ ok: false, code: -3, msg: "この企業のログインは現在無効です。管理者にお問い合わせください" })

    const user = await prisma.user.findFirst({
      where: { customerId: customer.id, username: userId, isDeleted: false },
      select: { id: true, passwordHash: true, userStatus: true, accountLocked: true, lockedUntil: true },
    })
    if (!user)
      return NextResponse.json({ ok: false, code: -1, msg: "ユーザーIDまたはパスワードが正しくありません" })

    if (user.accountLocked && user.lockedUntil && new Date() > new Date(user.lockedUntil)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { accountLocked: false, loginFailCount: 0, lockedUntil: null },
      })
      user.accountLocked = false
    }
    if (user.accountLocked || user.userStatus !== 1)
      return NextResponse.json({ ok: false, code: -2, msg: "アカウントがロックされています。30分後に再度お試しください" })

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid)
      return NextResponse.json({ ok: false, code: -1, msg: "ユーザーIDまたはパスワードが正しくありません" })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[pre-check] エラー:", err)
    return NextResponse.json({ ok: false, code: -99, msg: "サーバーエラーが発生しました" }, { status: 500 })
  }
}
