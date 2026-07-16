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
    tx.estimateHeader.findFirst({
      where: { id, customerId: ctx.customerId, isDeleted: false },
      include: { details: { where: { isDeleted: false }, select: { orderId: true } } },
    })
  ) as any
  const ownerErr = assertOwner(estimate as { customerId?: string } | null, ctx.customerId, ctx.isSuperAdmin)
  if (ownerErr) return ownerErr
  // ★重大バグ修正(2026/07/15): 部分注文対応後、estimateStatusが"ordered"になるのは
  // 全明細が注文済みの場合のみ(usp_ASP_...ではなくPOST /api/v1/orders側のロジック)。
  // 一部の明細だけ注文済みの見積は estimateStatus === "saved" のままのため、
  // 従来のチェックだけでは、既に実在するOrderに紐付いた明細を含む見積ごと
  // キャンセル(isDeleted=true)できてしまっていた。明細単位のorderIdも確認する。
  const hasOrderedDetail = (estimate.details as any[]).some((d: any) => d.orderId)
  if (estimate.estimateStatus === "ordered" || hasOrderedDetail)
    return NextResponse.json({ error: "注文済みの明細を含む見積はキャンセルできません" }, { status: 422 })
  await withTenant(ctx.customerId, ctx.isSuperAdmin, (tx) =>
    tx.estimateHeader.update({ where: { id }, data: { estimateStatus: "cancelled", isDeleted: true } })
  )
  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "DELETE", resource: "estimates", resourceId: id, req })
  return NextResponse.json({ cancelled: true, id })
}
