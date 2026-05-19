// GET /api/v1/orders/[id] — 注文詳細取得
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface Props { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Props) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  console.log("[GET /api/v1/orders/[id]]", id)

  const order = await (prisma as any).order.findFirst({
    where: { id, customerId: session.user.customerId!, isDeleted: false },
    include: {
      estimateHeader: {
        include: {
          details: { where: { isDeleted: false }, orderBy: { rowNo: "asc" } },
        },
      },
      statusHistories:     { orderBy: { occurredAt: "asc" } },
      specChangeHistories: { orderBy: { occurredAt: "asc" } },
    },
  })

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const est = order.estimateHeader

  return NextResponse.json({
    id:              order.id,
    orderNo:         order.orderNo ?? null,
    orderDate:       new Date(order.orderDate).toISOString().slice(0, 10),
    orderStatus:     order.orderStatus,
    totalAmount:     Number(order.totalAmount ?? 0),
    detailCount:     order.detailCount ?? est.details.length,
    trackingNo:      order.trackingNo ?? null,
    estimateNo:      est.estimateNo ?? null,
    customerCode:    est.customerCode,
    customerName:    est.customerName,
    customerOrderNo: est.customerOrderNo ?? null,
    destinationCode:    est.destinationCode ?? null,
    destinationName:    est.destinationName ?? null,
    destinationDept:    est.destinationDept ?? null,
    destinationPerson:  est.destinationPerson ?? null,
    destinationZip:     est.destinationZip ?? null,
    destinationAddress: est.destinationAddress ?? null,
    destinationTel:     est.destinationTel ?? null,
    destinationFax:     est.destinationFax ?? null,
    remarks:            est.remarks ?? null,
    details: est.details.map((d: any) => ({
      rowNo:            d.rowNo,
      materialCode:     d.materialCode,
      materialName:     d.materialName ?? null,
      kakouShiyou:      d.kakouShiyou ?? null,
      sizeT:            Number(d.sizeT),
      sizeA:            Number(d.sizeA),
      sizeB:            Number(d.sizeB),
      quantity:         d.quantity,
      unitPrice:        d.unitPrice  != null ? Number(d.unitPrice)  : null,
      totalPrice:       d.totalPrice != null ? Number(d.totalPrice) : null,
      shortestDelivery: d.shortestDelivery ?? null,
      deliveryDeadline: d.deliveryDeadline ? new Date(d.deliveryDeadline).toISOString() : null,
    })),
    statusHistories: (order.statusHistories ?? []).map((h: any) => ({
      id:           h.id,
      fromStatus:   h.fromStatus ?? null,
      toStatus:     h.toStatus,
      changedBy:    h.changedBy,
      changeReason: h.changeReason ?? null,
      trackingNo:   h.trackingNo ?? null,
      occurredAt:   new Date(h.occurredAt).toISOString(),
    })),
    specChangeHistories: (order.specChangeHistories ?? []).map((h: any) => ({
      id:           h.id,
      rowNo:        h.rowNo,
      fieldName:    h.fieldName,
      oldValue:     h.oldValue ?? null,
      newValue:     h.newValue,
      changeReason: h.changeReason ?? null,
      changedBy:    h.changedBy,
      occurredAt:   new Date(h.occurredAt).toISOString(),
    })),
  })
}
