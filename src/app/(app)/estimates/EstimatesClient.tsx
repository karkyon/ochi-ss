"use client"

import { useRouter } from "next/navigation"
import { useRef } from "react"
import Link from "next/link"

type Estimate = {
  id: string
  estimateNo: string
  estimateDate: string
  destinationName: string
  estimateStatus: string
  customerOrderNo: string
  detailCount: number
  totalAmount: number
}

type StatusInfo = { label: string; color: string }

interface Props {
  defaultValues: {
    dateFrom: string
    dateTo: string
    noFrom: string
    noTo: string
    destName: string
    orderNo: string
  }
  estimates: Estimate[]
  total: number
  page: number
  totalPages: number
  perPage: number
  statusLabelMap: Record<string, StatusInfo>
}

export default function EstimatesClient({
  defaultValues,
  estimates,
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
    console.log("[検索ボタン] クリック 検索条件:", Object.fromEntries(params.entries()))
    router.push(`/estimates?${params.toString()}`)
  }

  const handleClear = () => {
    console.log("[クリアボタン] クリック")
    formRef.current?.reset()
    router.push("/estimates")
  }

  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams()
    Object.entries(defaultValues).forEach(([k, v]) => { if (v) params.set(k, v) })
    params.set("page", String(p))
    return `/estimates?${params.toString()}`
  }

  return (
    <>
      {/* 検索フォーム */}
      <form
        ref={formRef}
        onSubmit={handleSearch}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5"
      >
        <p className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wide">
          検索条件
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* 見積日付 */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              見積日付
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                name="dateFrom"
                defaultValue={defaultValues.dateFrom}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-gray-400 text-sm">〜</span>
              <input
                type="date"
                name="dateTo"
                defaultValue={defaultValues.dateTo}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 見積No */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              見積No
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                name="noFrom"
                defaultValue={defaultValues.noFrom}
                placeholder="EST00001"
                maxLength={8}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-gray-400 text-sm">〜</span>
              <input
                type="text"
                name="noTo"
                defaultValue={defaultValues.noTo}
                placeholder="EST99999"
                maxLength={8}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 送り先名 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              送り先名
            </label>
            <input
              type="text"
              name="destName"
              defaultValue={defaultValues.destName}
              placeholder="部分一致"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* お客様注文No */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              お客様注文No
            </label>
            <input
              type="text"
              name="orderNo"
              defaultValue={defaultValues.orderNo}
              placeholder="部分一致"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            クリア
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-[#1a2744] text-white text-sm font-medium hover:bg-[#1a3a6e] transition-colors"
          >
            🔍 検索
          </button>
        </div>
      </form>

      {/* 検索結果 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* 結果件数 + ページネーション上部 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <p className="text-sm text-gray-600">
            検索結果：
            <span className="font-bold text-gray-800 mx-1">{total}</span>
            件
            {total > 0 && (
              <span className="text-xs text-gray-400 ml-2">
                （{(page - 1) * perPage + 1}〜
                {Math.min(page * perPage, total)} 件表示）
              </span>
            )}
          </p>
          <Pagination page={page} totalPages={totalPages} buildUrl={buildPageUrl} />
        </div>

        {/* テーブル */}
        {estimates.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-500 text-sm">
              検索条件に該当するデータがありません
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                    見積No
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                    見積日付
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                    送り先名
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">
                    合計額（税抜）
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap">
                    件数
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap">
                    状況
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {estimates.map((est, i) => {
                  const status = statusLabelMap[est.estimateStatus] ?? {
                    label: est.estimateStatus,
                    color: "bg-gray-100 text-gray-600",
                  }
                  return (
                    <tr
                      key={est.id}
                      className={i % 2 === 1 ? "bg-gray-50/50" : "bg-white"}
                    >
                      <td className="px-4 py-3 font-medium text-blue-700 whitespace-nowrap">
                        <Link
                          href={`/estimates/${est.id}/edit`}
                          onClick={() => console.log("[見積一覧] 編集クリック id:", est.id, "no:", est.estimateNo)}
                          className="hover:underline"
                        >
                          {est.estimateNo
                            ? est.estimateNo
                            : <span className="text-amber-600 text-xs font-normal">受付待ち</span>
                          }
                        </Link>
                        <div className="text-[10px] text-gray-400 mt-0.5">WebID: {est.id.slice(0, 8)}…</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {est.estimateDate
                          ? est.estimateDate.replace(/-/g, "/")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">
                        {est.destinationName}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800 whitespace-nowrap">
                        {est.totalAmount > 0
                          ? `¥${est.totalAmount.toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {est.detailCount}件
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/estimates/${est.id}/edit`}
                            className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors whitespace-nowrap"
                          >
                            編集
                          </Link>
                          <Link
                            href={`/orders/confirm?estimateId=${est.id}`}
                            className="px-2.5 py-1 text-xs rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors whitespace-nowrap"
                          >
                            🛒 注文
                          </Link>
                          <Link
                            href={`/estimates/new?copyFrom=${est.id}`}
                            className="px-2.5 py-1 text-xs rounded border border-sky-300 text-sky-700 hover:bg-sky-50 transition-colors whitespace-nowrap"
                          >
                            コピー
                          </Link>
                          <Link
                            href={`/api/v1/estimates/${est.id}/pdf`}
                            target="_blank"
                            className="px-2.5 py-1 text-xs rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors whitespace-nowrap"
                          >
                            見積書
                          </Link>
                          {est.estimateStatus !== "ordered" && est.estimateStatus !== "cancelled" && (
                            <button
                              onClick={async () => {
                                if (!confirm(`見積 ${est.estimateNo || est.id.slice(0,8)} をキャンセルしますか？`)) return
                                const res = await fetch(`/api/v1/estimates/${est.id}/cancel`, { method: "POST" })
                                if (res.ok) router.refresh()
                                else alert("キャンセル失敗")
                              }}
                              className="px-2.5 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap"
                            >
                              取消
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ページネーション下部 */}
        {totalPages > 1 && (
          <div className="flex justify-center px-5 py-4 border-t border-gray-100">
            <Pagination page={page} totalPages={totalPages} buildUrl={buildPageUrl} />
          </div>
        )}
      </div>
    </>
  )
}

// ページネーションコンポーネント
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
      <Link
        href={buildUrl(page - 1)}
        className={`px-2 py-1 text-sm rounded border ${
          page <= 1
            ? "border-gray-200 text-gray-300 pointer-events-none"
            : "border-gray-300 text-gray-600 hover:bg-gray-50"
        }`}
        aria-disabled={page <= 1}
      >
        ‹
      </Link>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`dots-${i}`} className="px-2 text-gray-400 text-sm">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={buildUrl(p)}
            className={`px-3 py-1 text-sm rounded border transition-colors ${
              p === page
                ? "bg-[#1a2744] text-white border-[#1a2744]"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p}
          </Link>
        )
      )}
      <Link
        href={buildUrl(page + 1)}
        className={`px-2 py-1 text-sm rounded border ${
          page >= totalPages
            ? "border-gray-200 text-gray-300 pointer-events-none"
            : "border-gray-300 text-gray-600 hover:bg-gray-50"
        }`}
        aria-disabled={page >= totalPages}
      >
        ›
      </Link>
    </div>
  )
}
