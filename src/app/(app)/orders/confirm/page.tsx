// /orders/confirm — 注文確認ページ
"use client"
// 納期有効期限チェック強化済み
import { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"

// check-deadline 統合済み
export default function OrderConfirmPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const estimateId = sp.get("estimateId")

  const [estimate, setEstimate] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [ordering, setOrdering] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!estimateId) { router.replace("/estimates"); return }
    fetch(`/api/v1/estimates/${estimateId}`)
      .then(r => r.json())
      .then(d => { setEstimate(d); setLoading(false) })
      .catch(() => { setError("データ取得失敗"); setLoading(false) })
  }, [estimateId, router])

  const handleOrder = useCallback(async () => {
    if (!estimateId) return
    setOrdering(true); setError("")
    try {
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "注文失敗")
      router.replace(`/orders/complete?orderId=${data.orderId}`)
    } catch (e: any) {
      setError(e.message); setOrdering(false)
    }
  }, [estimateId, router])

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-400">読み込み中...</div>

  const totalAmount = estimate?.details?.reduce((s: number, d: any) => s + (d.totalPrice ?? 0), 0) ?? 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-1 h-6 rounded-full bg-[#1a2744]" />
        <h1 className="font-bold text-gray-800 text-lg">注文確認</h1>
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {estimate && (
        <>
          {/* ヘッダー情報 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">注文内容確認</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div><p className="text-[10px] text-gray-400">見積No</p><p className="font-medium">{estimate.estimateNo ?? "—"}</p></div>
              <div><p className="text-[10px] text-gray-400">得意先名</p><p className="font-medium">{estimate.customerName ?? "—"}</p></div>
              <div><p className="text-[10px] text-gray-400">送り先名</p><p className="font-medium">{estimate.destinationName ?? "—"}</p></div>
              <div><p className="text-[10px] text-gray-400">合計金額（税別）</p><p className="font-bold text-lg">¥{totalAmount.toLocaleString()}</p></div>
              <div><p className="text-[10px] text-gray-400">明細件数</p><p className="font-medium">{estimate.details?.length ?? 0}件</p></div>
            </div>
          </div>

          {/* 明細テーブル */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">注文明細</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">No</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">材料</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">加工仕様</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">T</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">A</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">B</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">数量</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">単価</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">金額</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">最短納期</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {estimate.details?.map((d: any, i: number) => (
                    <tr key={d.rowNo} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-center text-gray-500">{i + 1}</td>
                      <td className="px-3 py-2 text-gray-700">{d.materialCode} <span className="text-xs text-gray-400">{d.materialName}</span></td>
                      <td className="px-3 py-2 text-gray-700">{d.kakouShiyou ?? "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{d.sizeT}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{d.sizeA}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{d.sizeB}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{d.quantity}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{d.unitPrice != null ? `¥${Number(d.unitPrice).toLocaleString()}` : "—"}</td>
                      <td className="px-3 py-2 text-right font-medium">{d.totalPrice != null ? `¥${Number(d.totalPrice).toLocaleString()}` : "—"}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{d.shortestDelivery ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              ← 入力画面へ戻る
            </button>
            <button
              type="button"
              onClick={handleOrder}
              disabled={ordering}
              className="px-6 py-2.5 rounded-lg bg-[#1a2744] text-white font-medium hover:bg-[#243561] disabled:opacity-50 transition-colors"
            >
              {ordering ? "処理中..." : "✅ 注文確定"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
