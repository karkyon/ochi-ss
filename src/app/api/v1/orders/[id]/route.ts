// GET /api/v1/orders/[id]
import { NextRequest, NextResponse } from "next/server"
import { getTenantCtx } from "@/lib/tenant-guard"
import { withTenant } from "@/lib/with-tenant"
import { audit } from "@/lib/audit-log"
interface Props { params: Promise<{ id: string }> }
export async function GET(req: NextRequest, { params }: Props) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error
  const { id } = await params
  const order = await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {
    return (tx as any).order.findFirst({
      where: { id, customerId: ctx.customerId, isDeleted: false },
      include: {
        estimateHeader: { include: { details: { where: { isDeleted: false }, orderBy: { rowNo: "asc" } } } },
        statusHistories: { orderBy: { occurredAt: "asc" } },
        // ★2026/07/13 修正: Prismaスキーマ上の実際のリレーション名は specChanges
        specChanges: { orderBy: { occurredAt: "asc" } },
      },
    })
  }) as any
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 })
  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "READ", resource: "orders", resourceId: id, req })
  const est = order.estimateHeader
  // ★重大バグ修正(2026/07/15): est.detailsは見積ヘッダー配下の全明細(他の
  // 部分注文・未注文分も含む)であり、この注文に属する明細だけに絞り込まないと
  // 「別の注文の明細まで表示される」事故になる。
  const orderDetails = (est.details as any[]).filter((d: any) => d.orderId === order.id)
  return NextResponse.json({
    id: order.id, orderNo: order.orderNo ?? null,
    orderDate: new Date(order.orderDate).toISOString().slice(0,10),
    orderStatus: order.orderStatus, totalAmount: Number(order.totalAmount ?? 0),
    detailCount: order.detailCount ?? orderDetails.length, trackingNo: order.trackingNo ?? null,
    estimateNo: est.estimateNo ?? null, customerCode: est.customerCode, customerName: est.customerName,
    customerOrderNo: est.customerOrderNo ?? null,
    destinationCode: est.destinationCode ?? null, destinationName: est.destinationName ?? null,
    destinationDept: est.destinationDept ?? null, destinationPerson: est.destinationPerson ?? null,
    destinationZip: est.destinationZip ?? null, destinationAddress: est.destinationAddress ?? null,
    destinationTel: est.destinationTel ?? null, destinationFax: est.destinationFax ?? null,
    remarks: est.remarks ?? null,
    details: orderDetails.map((d: any) => ({
      rowNo: d.rowNo, materialCode: d.materialCode, materialName: d.materialName ?? null,
      kakouShiyou: d.kakouShiyou ?? null,
      sizeT: Number(d.sizeT), sizeA: Number(d.sizeA), sizeB: Number(d.sizeB), quantity: d.quantity,
      unitPrice: d.unitPrice != null ? Number(d.unitPrice) : null,
      totalPrice: d.totalPrice != null ? Number(d.totalPrice) : null,
      shortestDelivery: d.shortestDelivery ?? null,
      deliveryDeadline: d.deliveryDeadline ? new Date(d.deliveryDeadline).toISOString() : null,
    })),
    statusHistories: (order.statusHistories ?? []).map((h: any) => ({
      id: h.id, fromStatus: h.fromStatus ?? null, toStatus: h.toStatus,
      changedBy: h.changedBy, changeReason: h.changeReason ?? null,
      trackingNo: h.trackingNo ?? null, occurredAt: new Date(h.occurredAt).toISOString(),
    })),
    // レスポンスのJSONキー名"specChangeHistories"はAPI互換性のため維持し、
    // 読み出し元(order.specChanges)のみPrismaの実際のリレーション名に合わせて修正。
    specChangeHistories: (order.specChanges ?? []).map((h: any) => ({
      id: h.id, rowNo: h.rowNo, fieldName: h.fieldName,
      oldValue: h.oldValue ?? null, newValue: h.newValue,
      changeReason: h.changeReason ?? null, changedBy: h.changedBy,
      occurredAt: new Date(h.occurredAt).toISOString(),
    })),
  })
}
