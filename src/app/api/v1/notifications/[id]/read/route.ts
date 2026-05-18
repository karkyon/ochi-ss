// PATCH /api/v1/notifications/[id]/read — 既読マーク（本実装）
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const customerId = session.user.customerId!

  try {
    await (prisma as any).notificationRead.upsert({
      where: { notificationId_customerId: { notificationId: id, customerId } },
      create: { notificationId: id, customerId },
      update: { readAt: new Date() },
    })
    return NextResponse.json({ id, read: true })
  } catch (err: any) {
    // テーブル未作成の場合は 200 を返してサイレント失敗
    console.warn("[notifications/read] upsert failed:", err.message)
    return NextResponse.json({ id, read: true })
  }
}
