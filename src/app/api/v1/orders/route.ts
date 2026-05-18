// src/app/api/v1/orders/route.ts
// GET /api/v1/orders — 注文一覧検索

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const dateFrom = searchParams.get("dateFrom")
  const dateTo   = searchParams.get("dateTo")
  const orderNo  = searchParams.get("orderNo")
  const status   = searchParams.get("status")
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const perPage  = 20

  console.log("[GET /api/v1/orders]", { dateFrom, dateTo, orderNo, status, page })

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
          select: {
            estimateNo:      true,
            destinationName: true,
            customerOrderNo: true,
          },
        },
      },
    }),
  ])

  return NextResponse.json({
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
    orders: rows.map(o => ({
      id:              o.id,
      orderNo:         o.orderNo ?? null,
      orderDate:       o.orderDate.toISOString().slice(0, 10),
      orderStatus:     o.orderStatus,
      totalAmount:     Number(o.totalAmount ?? 0),
      detailCount:     o.detailCount ?? 0,
      estimateNo:      o.estimateHeader.estimateNo ?? null,
      destinationName: o.estimateHeader.destinationName ?? null,
      customerOrderNo: o.estimateHeader.customerOrderNo ?? null,
    })),
  })
}
