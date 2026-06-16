// src/app/api/v1/orders/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { getTenantCtx, assertOwner } from "@/lib/tenant-guard"
import { withTenant } from "@/lib/with-tenant"
import { audit } from "@/lib/audit-log"

export async function GET(req: NextRequest) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error

  const { searchParams } = req.nextUrl
  const dateFrom = searchParams.get("dateFrom")
  const dateTo   = searchParams.get("dateTo")
  const orderNo  = searchParams.get("orderNo")
  const status   = searchParams.get("status")
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const perPage  = 20

  const where: Prisma.OrderWhereInput = {
    customerId: ctx.customerId, isDeleted: false,
    ...(dateFrom && { orderDate: { gte: new Date(dateFrom) } }),
    ...(dateTo   && { orderDate: { lte: new Date(dateTo + "T23:59:59") } }),
    ...(orderNo  && { orderNo: { contains: orderNo } }),
    ...(status   && { orderStatus: status }),
  }

  const [total, rows] = await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) =>
    Promise.all([
      (tx as any).order.count({ where }),
      (tx as any).order.findMany({
        where, orderBy: { orderDate: "desc" },
        skip: (page - 1) * perPage, take: perPage,
        include: { estimateHeader: { select: { estimateNo: true, destinationName: true, customerOrderNo: true } } },
      }),
    ])
  )

  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "READ", resource: "orders", req })
  return NextResponse.json({
    total, page, perPage, totalPages: Math.ceil((total as number) / perPage),
    orders: (rows as any[]).map(o => ({
      id: o.id, orderNo: o.orderNo ?? null,
      orderDate: o.orderDate.toISOString().slice(0, 10),
      orderStatus: o.orderStatus, totalAmount: Number(o.totalAmount ?? 0),
      detailCount: o.detailCount ?? 0,
      estimateNo: o.estimateHeader.estimateNo ?? null,
      destinationName: o.estimateHeader.destinationName ?? null,
      customerOrderNo: o.estimateHeader.customerOrderNo ?? null,
    })),
  })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error

  const body = await req.json()
  const { estimateId } = body as { estimateId: string }
  if (!estimateId) return NextResponse.json({ error: "estimateId required" }, { status: 400 })

  const estimate = await withTenant(ctx.customerId, ctx.isSuperAdmin, (tx) =>
    (tx as any).estimateHeader.findFirst({
      where: { id: estimateId, customerId: ctx.customerId, isDeleted: false },
      include: { details: { where: { isDeleted: false } } },
    })
  )
  const ownerErr = assertOwner(estimate, ctx.customerId, ctx.isSuperAdmin)
  if (ownerErr) return ownerErr
  if (estimate.estimateStatus === "ordered")
    return NextResponse.json({ error: "この見積は既に注文済みです" }, { status: 409 })
  if (estimate.details.length === 0)
    return NextResponse.json({ error: "明細が1件もありません" }, { status: 400 })

  const totalAmount = estimate.details.reduce((s: number, d: any) => s + Number(d.totalPrice ?? 0), 0)
  const detailCount = estimate.details.length

  async function generateOrderNo(): Promise<string> {
    const now = new Date()
    const yyyymmdd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`
    const prefix = `Z${yyyymmdd}`
    const last = await prisma.order.findFirst({ where: { orderNo: { startsWith: prefix } }, orderBy: { orderNo: "desc" }, select: { orderNo: true } })
    let seq = 1
    if (last?.orderNo) { const s = parseInt(last.orderNo.slice(-3), 10); if (!isNaN(s)) seq = s + 1 }
    if (seq > 999) throw new Error("本日の注文番号が上限に達しました")
    return `${prefix}${String(seq).padStart(3, "0")}`
  }
  const orderNo = await generateOrderNo()

  const order = await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {
    const o = await (tx as any).order.create({
      data: { orderNo, estimateHeaderId: estimateId, customerId: ctx.customerId, orderStatus: "pending", totalAmount, detailCount },
    })
    await (tx as any).estimateHeader.update({ where: { id: estimateId }, data: { estimateStatus: "ordered" } })
    return o
  })

  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "CREATE", resource: "orders", resourceId: order.id, req, detail: { orderNo: order.orderNo } })

  try {
    await prisma.outboxEvent.create({
      data: {
        aggregateType: "order", aggregateId: order.id, eventType: "order.placed",
        payload: JSON.parse(JSON.stringify({ orderNo: order.orderNo, customerCode: ctx.companyCode, orderDate: order.orderDate?.toISOString() })),
        status: "pending",
      },
    })
  } catch (e) { console.error("[POST /orders] outbox:", e) }

  return NextResponse.json({ orderId: order.id, orderNo: order.orderNo, orderStatus: order.orderStatus }, { status: 201 })
}
