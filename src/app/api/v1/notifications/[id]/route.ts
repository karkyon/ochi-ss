// src/app/api/v1/notifications/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getTenantCtx } from "@/lib/tenant-guard"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error
  const { id } = await params
  const notification = await prisma.notification.findFirst({
    where: { id, isDeleted: false },
  })
  if (!notification) return NextResponse.json({ error: "Not found" }, { status: 404 })
  // ★重大バグ修正(2026/07/15): targetCustomersが自社を含まない(＝他の得意先
  // 限定/返信)通知でも、IDを直接指定すれば誰でも内容を取得できてしまっていた。
  // 一覧APIと同じ基準(null=全顧客向け、または自分のcustomerIdを含む)で
  // アクセス可否を判定する。
  const target = notification.targetCustomers as unknown
  const isVisible =
    target === null ||
    target === undefined ||
    (Array.isArray(target) && target.includes(ctx.customerId))
  if (!isVisible) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(notification)
}
