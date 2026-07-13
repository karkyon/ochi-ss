// src/app/api/v1/admin/company-settings/route.ts
// 自社情報設定（見積書PDF等に表示する自社情報）の取得・更新。Admin(role>=3)専用。
// 既存の SystemSetting(key-value) テーブルを利用するため、専用テーブルの
// マイグレーションは不要。
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const KEYS = [
  "company_name", "company_zip", "company_address",
  "company_tel", "company_fax", "company_email", "payment_terms",
] as const

const DEFAULTS: Record<string, string> = {
  company_name: "越智製作所",
  company_zip: "577-0802",
  company_address: "大阪府東大阪市小若江3-4-1",
  company_tel: "072-882-5524",
  company_fax: "072-882-5527",
  company_email: "weborder@ochi-ss.co.jp",
  payment_terms: "月末締め翌月末払い",
}

function isAdmin(session: any) {
  const level = session?.user?.role ?? 0
  return level >= 3
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const rows = await prisma.systemSetting.findMany({ where: { key: { in: [...KEYS] } } })
  const map: Record<string, string> = { ...DEFAULTS }
  for (const r of rows) map[r.key] = r.value

  return NextResponse.json({ settings: map })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: Record<string, string>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const updates = KEYS.filter(k => typeof body[k] === "string")
  if (updates.length === 0) {
    return NextResponse.json({ error: "更新対象の項目がありません" }, { status: 400 })
  }

  const updatedBy = (session.user as any).userId ?? (session.user as any).id ?? "admin"

  await Promise.all(updates.map(k =>
    prisma.systemSetting.upsert({
      where: { key: k },
      update: { value: body[k], updatedBy },
      create: { key: k, value: body[k], updatedBy },
    })
  ))

  return NextResponse.json({ ok: true })
}
