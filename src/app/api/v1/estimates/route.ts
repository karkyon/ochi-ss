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

  // 検索条件取得
  const dateFrom  = searchParams.get("dateFrom")
  const dateTo    = searchParams.get("dateTo")
  const noFrom    = searchParams.get("noFrom")
  const noTo      = searchParams.get("noTo")
  const destName  = searchParams.get("destName")
  const orderNo   = searchParams.get("orderNo")
  const page      = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const perPage   = 20

  // WHERE 条件組み立て
  const where: Prisma.EstimateHeaderWhereInput = {
    customerId: session.user.userId,   // 自社データのみ
    isDeleted: false,
    ...(dateFrom && { estimateDate: { gte: new Date(dateFrom) } }),
    ...(dateTo   && { estimateDate: { lte: new Date(dateTo + "T23:59:59") } }),
    ...(noFrom   && { estimateNo: { gte: noFrom } }),
    ...(noTo     && { estimateNo: { lte: noTo } }),
    ...(destName && { destinationName: { contains: destName } }),
    ...(orderNo  && { customerOrderNo: { contains: orderNo } }),
  }

  const [total, rows] = await Promise.all([
    prisma.estimateHeader.count({ where }),
    prisma.estimateHeader.findMany({
      where,
      orderBy: { estimateDate: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id:              true,
        estimateNo:      true,
        estimateDate:    true,
        destinationName: true,
        estimateStatus:  true,
        customerOrderNo: true,
        details: {
          where: { isDeleted: false },
          select: {
            totalPrice: true,
          },
        },
      },
    }),
  ])

  // 集計: 合計金額・明細件数
  const data = rows.map((r) => {
    const detailCount = r.details.length
    const totalAmount = r.details.reduce(
      (sum, d) => sum + Number(d.totalPrice ?? 0),
      0
    )
    return {
      id:              r.id,
      estimateNo:      r.estimateNo ?? "（未採番）",
      estimateDate:    r.estimateDate?.toISOString().slice(0, 10) ?? "",
      destinationName: r.destinationName ?? "",
      estimateStatus:  r.estimateStatus,
      customerOrderNo: r.customerOrderNo ?? "",
      detailCount,
      totalAmount,
    }
  })

  return NextResponse.json({ total, page, perPage, data })
}
