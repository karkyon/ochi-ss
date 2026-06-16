// src/app/api/v1/orders/[id]/cancel/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getTenantCtx, assertOwner } from "@/lib/tenant-guard"
import { withTenant } from "@/lib/with-tenant"
import { audit } from "@/lib/audit-log"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = await withTenant(ctx.customerId, ctx.isSuperAdmin, (tx) =>
    tx.order.findFirst({ where: { id, customerId: ctx.customerId, isDeleted: false } })
  ) as any
  const ownerErr = assertOwner(order as { customerId?: string } | null, ctx.customerId, ctx.isSuperAdmin)
  if (ownerErr) return ownerErr
  if (!["pending", "confirmed"].includes(order.orderStatus))
    return NextResponse.json({ error: `${order.orderStatus} の注文はキャンセルできません` }, { status: 422 })
  await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {
    await tx.order.update({ where: { id }, data: { orderStatus: "cancelled" } })
    await tx.estimateHeader.update({ where: { id: order.estimateHeaderId }, data: { estimateStatus: "saved" } })
    await tx.orderStatusHistory.create({
      data: { orderId: id, fromStatus: order.orderStatus, toStatus: "cancelled",
              changedBy: ctx.userId, changeReason: "顧客によるキャンセル", changeSource: "web" },
    }).catch(() => {})
  })
  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "UPDATE", resource: "orders", resourceId: id, req, detail: { action: "cancel" } })
  return NextResponse.json({ cancelled: true, id, orderStatus: "cancelled" })
}
