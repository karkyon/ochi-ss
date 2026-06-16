// src/app/api/v1/notifications/[id]/read/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getTenantCtx } from "@/lib/tenant-guard"
import { withTenant } from "@/lib/with-tenant"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error
  const { id } = await params

  await withTenant(ctx.customerId, ctx.isSuperAdmin, (tx) =>
    (tx as any).notificationRead.upsert({
      where: { notificationId_customerId: { notificationId: id, customerId: ctx.customerId } },
      create: { notificationId: id, customerId: ctx.customerId },
      update: { readAt: new Date() },
    })
  )
  return NextResponse.json({ read: true })
}
