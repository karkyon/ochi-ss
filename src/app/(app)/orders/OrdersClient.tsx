// src/app/(app)/orders/OrdersClient.tsx
// STEP 22: 注文一覧クライアントコンポーネント

"use client"

import { useRouter } from "next/navigation"
import { useRef } from "react"
import Link from "next/link"

type Order = {
  id:              string
  orderNo:         string
  orderDate:       string
  estimateNo:      string
  destinationName: string
  customerOrderNo: string
  orderStatus:     string
  totalAmount:     number
  detailCount:     number
}

type StatusInfo = { label: string; color: string }

interface Props {
  defaultValues: {
    dateFrom: string
    dateTo:   string
    orderNo:  string
    status:   string
  }
  orders:         Order[]
  total:          number
  page:           number
  totalPages:     number
  perPage:        number
  statusLabelMap: Record<string, StatusInfo>
}

const STATUS_OPTIONS = [
  { value: "",            label: "すべて" },
  { value: "pending",     label: "処理中" },
  { value: "confirmed",   label: "確定" },
  { value: "in_progress", label: "製造中" },
  { value: "shipped",     label: "出荷済" },
  { value: "completed",   label: "完了" },
  { value: "cancelled",   label: "取消" },
]

export default function OrdersClient({
  defaultValues,
  orders,
  total,
  page,
  totalPages,
  perPage,
  statusLabelMap,
}: Props) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formRef.current) return
    const fd = new FormData(formRef.current)
    const params = new URLSearchParams()
    for (const [k, v] of fd.entries()) {
      if (v) params.set(k, v as string)
    }
    params.set("page", "1")
    console.log("[注文検索] クリック 検索条件:", Object.fromEntries(params.entries()))
    router.push(`/orders?${params.toString()}`)
  }

  const handleClear = () => {
    formRef.current?.reset()
    router.push("/orders")
  }

  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams()
    Object.entries(defaultValues).forEach(([k, v]) => { if (v) params.set(k, v) })
    params.set("page", String(p))
    return `/orders?${params.toString()}`
  }

  return (
    <>
      {/* 検索パネル */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">検索条件</p>
        <form ref={formRef} onSubmit={handleSearch}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">注文日付（From）</label>
              <input
                type="date"
                name="dateFrom"
                defaultValue={defaultValues.dateFrom}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">注文日付（To）</label>
              <input
                type="date"
                name="dateTo"
                defaultValue={defaultValues.dateTo}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">注文No</label>
              <input
                type="text"
                name="orderNo"
                defaultValue={defaultValues.orderNo}
                placeholder="W2026..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">注文状況</label>
              <select
                name="status"
                defaultValue={defaultValues.status}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              クリア
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-medium rounded-lg bg-[#1a2744] text-white hover:bg-[#243561] transition-colors"
            >
              🔍 検索
            </button>
          </div>
        </form>
      </div>

      {/* 一覧テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            注文一覧
          </p>
          <p className="text-xs text-gray-400">
            {total}件中 {(page - 1) * perPage + 1}〜{Math.min(page * perPage, total)}件表示
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="px-5 py-16 text-center text-gray-400 text-sm">
            対象の注文がありません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">注文No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">注文日付</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">見積No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">送り先名</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">合計金額</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">明細数</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">状況</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map(ord => {
                  const st = statusLabelMap[ord.orderStatus] ?? { label: ord.orderStatus, color: "bg-gray-100 text-gray-600" }
                  return (
                    <tr key={ord.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-[#1a2744] whitespace-nowrap">
                        {ord.orderNo}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {ord.orderDate.replace(/-/g, "/")}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {ord.estimateNo || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">
                        {ord.destinationName || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800 whitespace-nowrap">
                        {ord.totalAmount > 0 ? `¥${ord.totalAmount.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {ord.detailCount}件
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/orders/${ord.id}`}
                            className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors whitespace-nowrap"
                          >
                            詳細
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="flex justify-center px-5 py-4 border-t border-gray-100">
            <Pagination page={page} totalPages={totalPages} buildUrl={buildPageUrl} />
          </div>
        )}
      </div>
    </>
  )
}

function Pagination({
  page,
  totalPages,
  buildUrl,
}: {
  page: number
  totalPages: number
  buildUrl: (p: number) => string
}) {
  if (totalPages <= 1) return null
  const pages: (number | "...")[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...")
    }
  }
  return (
    <div className="flex items-center gap-1">
      <Link href={buildUrl(page - 1)} aria-disabled={page <= 1}
        className={`px-2 py-1 text-sm rounded border ${page <= 1 ? "border-gray-200 text-gray-300 pointer-events-none" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
        ‹
      </Link>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`dots-${i}`} className="px-2 text-gray-400 text-sm">…</span>
        ) : (
          <Link key={p} href={buildUrl(p)}
            className={`px-3 py-1 text-sm rounded border transition-colors ${p === page ? "bg-[#1a2744] text-white border-[#1a2744]" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
            {p}
          </Link>
        )
      )}
      <Link href={buildUrl(page + 1)} aria-disabled={page >= totalPages}
        className={`px-2 py-1 text-sm rounded border ${page >= totalPages ? "border-gray-200 text-gray-300 pointer-events-none" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
        ›
      </Link>
    </div>
  )
}
