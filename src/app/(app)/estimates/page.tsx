import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import Link from "next/link"
import EstimatesClient from "./EstimatesClient"

// ステータス表示マップ
const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:     { label: "下書き",   color: "bg-gray-100 text-gray-600" },
  saved:     { label: "未処理",   color: "bg-blue-100 text-blue-700" },
  ordered:   { label: "注文済",   color: "bg-green-100 text-green-700" },
  cancelled: { label: "取消",     color: "bg-red-100 text-red-600" },
}

type SearchParams = {
  dateFrom?: string
  dateTo?: string
  noFrom?: string
  noTo?: string
  destName?: string
  orderNo?: string
  page?: string
}

// 当月の初日・末日をデフォルト値として使用
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

export default async function EstimatesPage({
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
  const noFrom   = sp.noFrom   ?? ""
  const noTo     = sp.noTo     ?? ""
  const destName = sp.destName ?? ""
  const orderNo  = sp.orderNo  ?? ""

  // DB検索
  console.log("[/estimates page] session.user.customerId:", session!.user.customerId)
  console.log("[/estimates page] 検索条件:", { dateFrom, dateTo, noFrom, noTo, destName, orderNo, page })
  const where: Prisma.EstimateHeaderWhereInput = {
    customerId: session!.user.customerId!,
    isDeleted:  false,
    estimateDate: {
      gte: new Date(dateFrom),
      lte: new Date(dateTo + "T23:59:59"),
    },
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
          select: { totalPrice: true },
        },
      },
    }),
  ])

  const estimates = rows.map((r) => ({
    id:              r.id,
    estimateNo:      r.estimateNo ?? "（未採番）",
    estimateDate:    r.estimateDate?.toISOString().slice(0, 10) ?? "",
    destinationName: r.destinationName ?? "—",
    estimateStatus:  r.estimateStatus,
    customerOrderNo: r.customerOrderNo ?? "",
    detailCount:     r.details.length,
    totalAmount:     r.details.reduce((s, d) => s + Number(d.totalPrice ?? 0), 0),
  }))

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">

      {/* ページタイトル */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-[#1a2744]" />
          <h1 className="font-bold text-gray-800 text-lg">お見積り履歴検索</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/estimates/new"
            className="px-4 py-2 rounded-lg bg-[#1a2744] text-white text-sm font-medium hover:bg-[#1a3a6e] transition-colors"
          >
            ＋ 新規見積作成
          </Link>
          <Link
            href="/dashboard"
            className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
          >
            ← メインメニュー
          </Link>
        </div>
      </div>

      {/* 検索フォーム — Client Component */}
      <EstimatesClient
        defaultValues={{ dateFrom, dateTo, noFrom, noTo, destName, orderNo }}
        estimates={estimates}
        total={total}
        page={page}
        totalPages={totalPages}
        perPage={perPage}
        statusLabelMap={STATUS_LABEL}
      />
    </div>
  )
}
