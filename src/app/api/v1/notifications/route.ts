// GET /api/v1/notifications
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getTenantCtx } from "@/lib/tenant-guard"
import { withTenant } from "@/lib/with-tenant"

export async function GET(req: NextRequest) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error

  const now = new Date()
  const notifications = await prisma.notification.findMany({
    where: {
      isDeleted: false,
      publishedAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
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
