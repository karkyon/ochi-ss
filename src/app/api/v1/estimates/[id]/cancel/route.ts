// src/app/api/v1/estimates/[id]/cancel/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getTenantCtx, assertOwner } from "@/lib/tenant-guard"
import { withTenant } from "@/lib/with-tenant"
import { audit } from "@/lib/audit-log"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const estimate = await withTenant(ctx.customerId, ctx.isSuperAdmin, (tx) =>
    tx.estimateHeader.findFirst({ where: { id, customerId: ctx.customerId, isDeleted: false } })
  ) as any
  const ownerErr = assertOwner(estimate as { customerId?: string } | null, ctx.customerId, ctx.isSuperAdmin)
  if (ownerErr) return ownerErr
  if (estimate.estimateStatus === "ordered")
    return NextResponse.json({ error: "注文済みの見積はキャンセルできません" }, { status: 422 })
  await withTenant(ctx.customerId, ctx.isSuperAdmin, (tx) =>
    tx.estimateHeader.update({ where: { id }, data: { estimateStatus: "cancelled", isDeleted: true } })
  )
  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "DELETE", resource: "estimates", resourceId: id, req })
  return NextResponse.json({ cancelled: true, id })
}
