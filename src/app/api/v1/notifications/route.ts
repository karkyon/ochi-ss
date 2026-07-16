// GET /api/v1/notifications
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { getTenantCtx } from "@/lib/tenant-guard"
import { withTenant } from "@/lib/with-tenant"

export async function GET(req: NextRequest) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error

  const now = new Date()
  // ★重大バグ修正(2026/07/15): targetCustomers(null=全顧客向け公開通知、
  // 配列=指定した得意先のみ向け)を一切見ずに全通知を返していたため、
  // ある得意先向け限定の通知(返信含む)が他の全得意先にも見えてしまう
  // マルチテナント漏洩になっていた。自分向け(null または自分のcustomerIdを含む)
  // の通知だけに絞り込む。
  const notifications = await prisma.notification.findMany({
    where: {
      isDeleted: false,
      publishedAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      AND: [
        {
          OR: [
            { targetCustomers: { equals: Prisma.JsonNull } },
            { targetCustomers: { array_contains: ctx.customerId } },
          ],
        },
      ],
    },
    orderBy: { publishedAt: "desc" },
    take: 50,
  })

  let readIds = new Set<string>()
  try {
    const reads = await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {
      return (tx as any).notificationRead.findMany({
        where: { customerId: ctx.customerId },
        select: { notificationId: true },
      })
    }) as any[]
    readIds = new Set(reads.map((r: any) => r.notificationId))
  } catch { /* 全件未読扱い */ }

  const result = notifications.map((n: any) => ({ ...n, isRead: readIds.has(n.id) }))
  return NextResponse.json({
    total: result.length,
    unreadCount: result.filter((n: any) => !n.isRead).length,
    notifications: result,
  })
}
