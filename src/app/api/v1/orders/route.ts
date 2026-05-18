// src/app/api/v1/orders/route.ts
// GET /api/v1/orders — 注文一覧
// POST /api/v1/orders — 注文確定

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

// ── GET 一覧 ──
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const dateFrom = searchParams.get("dateFrom")
  const dateTo   = searchParams.get("dateTo")
  const orderNo  = searchParams.get("orderNo")
  const status   = searchParams.get("status")
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const perPage  = 20

  const where: Prisma.OrderWhereInput = {
    customerId: session.user.customerId!,
    isDeleted: false,
    ...(dateFrom && { orderDate: { gte: new Date(dateFrom) } }),
    ...(dateTo   && { orderDate: { lte: new Date(dateTo + "T23:59:59") } }),
    ...(orderNo  && { orderNo: { contains: orderNo } }),
    ...(status   && { orderStatus: status }),
  }

  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { orderDate: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        estimateHeader: {
          select: { estimateNo: true, destinationName: true, customerOrderNo: true },
        },
      },
    }),
  ])

  return NextResponse.json({
    total, page, perPage,
    totalPages: Math.ceil(total / perPage),
    orders: rows.map(o => ({
      id: o.id,
      orderNo: o.orderNo ?? null,
      orderDate: o.orderDate.toISOString().slice(0, 10),
      orderStatus: o.orderStatus,
      totalAmount: Number(o.totalAmount ?? 0),
      detailCount: o.detailCount ?? 0,
      estimateNo: o.estimateHeader.estimateNo ?? null,
      destinationName: o.estimateHeader.destinationName ?? null,
      customerOrderNo: o.estimateHeader.customerOrderNo ?? null,
    })),
  })
}

// ── POST 注文確定 ──
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { estimateId } = body as { estimateId: string }

  if (!estimateId) {
    return NextResponse.json({ error: "estimateId required" }, { status: 400 })
  }

  console.log("[POST /api/v1/orders] estimateId:", estimateId)

  // 見積取得・バリデーション
  const estimate = await prisma.estimateHeader.findFirst({
    where: { id: estimateId, customerId: session.user.customerId!, isDeleted: false },
    include: { details: { where: { isDeleted: false } } },
  })
  if (!estimate) return NextResponse.json({ error: "見積が見つかりません" }, { status: 404 })
  if (estimate.estimateStatus === "ordered") {
    return NextResponse.json({ error: "この見積は既に注文済みです" }, { status: 409 })
  }
  if (estimate.details.length === 0) {
    return NextResponse.json({ error: "明細が1件もありません" }, { status: 400 })
  }

  const totalAmount = estimate.details.reduce((s, d) => s + Number(d.totalPrice ?? 0), 0)
  const detailCount = estimate.details.length

  // 注文番号採番: Z + YYYYMMDD + 3桁連番 (例: Z2026051701)
  async function generateOrderNo(): Promise<string> {
    const now = new Date()
    const yyyymmdd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`
    const prefix = `Z${yyyymmdd}`
    const last = await prisma.order.findFirst({
      where: { orderNo: { startsWith: prefix } },
      orderBy: { orderNo: "desc" },
      select: { orderNo: true },
    })
    let seq = 1
    if (last?.orderNo) {
      const lastSeq = parseInt(last.orderNo.slice(-3), 10)
      if (!isNaN(lastSeq)) seq = lastSeq + 1
    }
    if (seq > 999) throw new Error("本日の注文番号が上限（999件）に達しました")
    return `${prefix}${String(seq).padStart(3, "0")}`
  }

  const orderNo = await generateOrderNo()

  // 注文レコード作成 + 見積ステータス更新 (transaction)
  const order = await prisma.$transaction(async tx => {
    const o = await tx.order.create({
      data: {
        orderNo,
        estimateHeaderId: estimateId,
        customerId: session.user.customerId!,
        orderStatus: "pending",
        totalAmount,
        detailCount,
      },
    })
    await tx.estimateHeader.update({
      where: { id: estimateId },
      data: { estimateStatus: "ordered" },
    })
    return o
  })

  // Outbox Event — SQL Server WEBデータ確認へ非同期送信
    try {
      await prisma.outboxEvent.create({
        data: {
          aggregateType: "order",
          aggregateId:   order.id,
          eventType:     "order.placed",
          payload:       JSON.parse(JSON.stringify({
            orderNo:         order.orderNo,
            customerCode:    session.user.companyCode,
            orderDate:       order.orderDate?.toISOString(),
          })),
          status: "pending",
        },
      })
    } catch (e) {
      console.error("[POST /orders] outbox create failed:", e)
    }

    return NextResponse.json({ orderId: order.id, orderNo: order.orderNo, orderStatus: order.orderStatus }, { status: 201 })
}
