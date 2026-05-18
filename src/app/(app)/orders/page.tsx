// src/app/(app)/orders/page.tsx
// STEP 22: 注文検索・一覧ページ

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import Link from "next/link"
import OrdersClient from "./OrdersClient"

type SearchParams = {
  dateFrom?: string
  dateTo?: string
  orderNo?: string
  status?: string
  page?: string
}

function defaultDateRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()
  return {
    dateFrom: `${y}-${m}-01`,
    dateTo:   `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
  }
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:     { label: "処理中",   color: "bg-yellow-100 text-yellow-700" },
  confirmed:   { label: "確定",     color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "製造中",   color: "bg-purple-100 text-purple-700" },
  shipped:     { label: "出荷済",   color: "bg-teal-100 text-teal-700" },
  completed:   { label: "完了",     color: "bg-green-100 text-green-700" },
  cancelled:   { label: "取消",     color: "bg-red-100 text-red-600" },
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const session = await auth()
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? "1", 10))
  const perPage = 20
  const def = defaultDateRange()

  const dateFrom = sp.dateFrom ?? def.dateFrom
  const dateTo   = sp.dateTo   ?? def.dateTo
  const orderNo  = sp.orderNo  ?? ""
  const status   = sp.status   ?? ""

  console.log("[/orders page] session.user.customerId:", session!.user.customerId)

  const where: Prisma.OrderWhereInput = {
    customerId: session!.user.customerId!,
    isDeleted: false,
    orderDate: {
      gte: new Date(dateFrom),
      lte: new Date(dateTo + "T23:59:59"),
    },
    ...(orderNo && { orderNo: { contains: orderNo } }),
    ...(status  && { orderStatus: status }),
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

  const orders = rows.map(o => ({
    id:              o.id,
    orderNo:         o.orderNo ?? "（採番待ち）",
    orderDate:       o.orderDate.toISOString().slice(0, 10),
    estimateNo:      o.estimateHeader.estimateNo ?? "",
    destinationName: o.estimateHeader.destinationName ?? "",
    customerOrderNo: o.estimateHeader.customerOrderNo ?? "",
    orderStatus:     o.orderStatus,
    totalAmount:     Number(o.totalAmount ?? 0),
    detailCount:     o.detailCount ?? 0,
  }))

  const totalPages = Math.ceil(total / perPage)

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-[#1a2744]" />
          <h1 className="font-bold text-gray-800 text-lg">注文一覧</h1>
        </div>
        <Link
          href="/dashboard"
          className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
        >
          メインメニュー
        </Link>
      </div>

      <OrdersClient
        defaultValues={{ dateFrom, dateTo, orderNo, status }}
        orders={orders}
        total={total}
        page={page}
        totalPages={totalPages}
        perPage={perPage}
        statusLabelMap={STATUS_LABEL}
      />
    </div>
  )
}
