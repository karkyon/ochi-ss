// GET /api/v1/notifications — お知らせ一覧（既読状態付き）
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()
  const customerId = session.user.customerId!

  const notifications = await prisma.notification.findMany({
    where: {
      isDeleted: false,
      publishedAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    },
    orderBy: { publishedAt: "desc" },
    take: 50,
  })

  // 既読状態取得
  let readIds = new Set<string>()
  try {
    const reads = await (prisma as any).notificationRead.findMany({
      where: { customerId },
      select: { notificationId: true },
    })
    readIds = new Set(reads.map((r: any) => r.notificationId))
  } catch { /* テーブル未作成時は全件未読扱い */ }

  const result = notifications.map((n: any) => ({
    ...n,
    isRead: readIds.has(n.id),
  }))

  return NextResponse.json({
    total: result.length,
    unreadCount: result.filter((n: any) => !n.isRead).length,
    notifications: result,
  })
}
