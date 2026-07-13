// /orders/confirm — 注文確認ページ（納期有効期限チェック付き）
"use client"
import { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

export default function OrderConfirmPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const estimateId = sp.get("estimateId")

  const [estimate, setEstimate]       = useState<any>(null)
  const [loading, setLoading]         = useState(true)
  const [ordering, setOrdering]       = useState(false)
  const [error, setError]             = useState("")
  const [expiredRows, setExpiredRows] = useState<number[]>([])   // 期限切れ行番号
  // 材料コード→材料名 解決用マップ（明細のmaterialNameがnullでも確実に名称表示するため）
  const [materials, setMaterials] = useState<Record<string, string>>({})

  // 見積データ取得 + 納期有効期限チェック
  useEffect(() => {
    if (!estimateId) { router.replace("/estimates"); return }

    const load = async () => {
      try {
        // 見積データ取得
        const res = await fetch(`/api/v1/estimates/${estimateId}`)
        if (!res.ok) { setError("見積データ取得失敗"); setLoading(false); return }
        const d = await res.json()
        setEstimate(d)

        // 材料マスタ取得（明細のmaterialNameがnullの場合でも材料名を表示するため）
        try {
          const mres = await fetch("/api/v1/masters/materials")
          if (mres.ok) {
            const mlist = await mres.json()
            const map: Record<string, string> = {}
            for (const m of mlist) map[m.materialCode] = m.materialName
            setMaterials(map)
          }
        } catch { /* 材料名解決は補助情報のためサイレントに継続 */ }

        // 納期有効期限チェック
        const now = new Date()
        const expired: number[] = (d.details ?? [])
          .filter((det: any) => det.deliveryDeadline && new Date(det.deliveryDeadline) < now)
          .map((det: any) => det.rowNo)
        setExpiredRows(expired)
      } catch {
        setError("データ取得に失敗しました")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [estimateId, router])

  const handleOrder = useCallback(async () => {
    if (!estimateId) return
    if (expiredRows.length > 0) {
      setError(`納期有効期限切れの明細があります（No.${expiredRows.join("、No.")}）。見積を再編集して計算し直してください。`)
      return
    }
    setOrdering(true); setError("")
    try {
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateId }),
      })
      const data = await res.json()
      if (res.status === 409) {
        // 既に注文済みの場合は既存注文詳細へ誘導
        router.replace(`/orders/${data.orderId}`)
        return
      }
      if (!res.ok) throw new Error(data.error ?? "注文に失敗しました")
      router.replace(`/orders/complete?orderId=${data.orderId}`)
    } catch (e: any) {
      setError(e.message); setOrdering(false)
    }
  }, [estimateId, expiredRows, router])

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-400">読み込み中...</div>
  )

  const totalAmount = estimate?.details?.reduce((s: number, d: any) => s + (Number(d.totalPrice) ?? 0), 0) ?? 0
  const hasExpired  = expiredRows.length > 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-[#1a2744]" />
          <h1 className="font-bold text-gray-800 text-lg">注文確認</h1>
        </div>
        <Link href={estimateId ? `/estimates/${estimateId}/edit` : "/estimates"}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
          ← 入力画面へ戻る
        </Link>
      </div>

      {/* 納期期限切れ警告バナー */}
      {hasExpired && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-sm flex items-start gap-2">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-semibold">納期有効期限が切れた明細があります</p>
            <p className="text-xs mt-0.5">対象明細: No.{expiredRows.join("、No.")} — 見積編集画面で再計算してから注文してください。</p>
          </div>
        </div>
      )}

      {/* エラー */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      )}

      {estimate && (
        <>
          {/* ヘッダー情報 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">注文内容確認</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              {[
                { label: "見積No",        val: estimate.estimateNo ?? "—" },
                { label: "送り先名",       val: estimate.destinationName ?? "—" },
                { label: "お客様注文番号", val: estimate.customerOrderNo || "—" },
                { label: "希望納期",       val: estimate.requestNouki || "—" },
                { label: "備考",           val: estimate.remarks || "—" },
              ].map(({ label, val }) => (
                <div key={label}>
                  <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                  <p className="font-medium text-gray-800 text-sm">{val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 明細テーブル */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">注文明細</p>
              <p className="text-sm font-bold text-gray-800">合計 ¥{totalAmount.toLocaleString()}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {["No","材料","加工仕様","寸法T×A×B(mm)","公差(T/A/B)","面取り(4C/8C)","数量","単価","合計","最短納期","納期有効期限"].map(h => (
                      <th key={h} className="px-3 py-2 text-center text-[11px] font-semibold text-white whitespace-nowrap border border-[#14293f]" style={{ background: "#1e3a5f" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(estimate.details ?? []).map((d: any, idx: number) => {
                    const expired = expiredRows.includes(d.rowNo)
                    const deadline = d.deliveryDeadline ? new Date(d.deliveryDeadline) : null
                    const matName = materials[d.materialCode] || d.materialName || d.materialCode
                    const fmtK = (u: any, l: any) => (u == null && l == null) ? "—" : `+${u ?? 0}/-${Math.abs(l ?? 0)}`
                    return (
                      <tr key={d.rowNo} className={expired ? "bg-amber-50" : idx % 2 === 1 ? "bg-slate-50" : "bg-white"}>
                        <td className="px-3 py-2 text-center font-medium border-r border-gray-200">
                          {d.rowNo}
                          {expired && <span className="ml-1 text-amber-600">⚠</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap border-r border-gray-200 font-semibold text-gray-800">{matName}</td>
                        <td className="px-3 py-2 whitespace-nowrap border-r border-gray-200">
                          <div className="font-medium text-gray-800">{d.kakouShiyou || "—"}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">T:{d.kakouT || "-"} A:{d.kakouA || "-"} B:{d.kakouB || "-"}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-center border-r border-gray-200">
                          {Number(d.sizeT)}×{Number(d.sizeA)}×{Number(d.sizeB)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-[10px] font-mono text-gray-600 border-r border-gray-200">
                          <div>T {fmtK(d.kousaTUpper, d.kousaTLower)}</div>
                          <div>A {fmtK(d.kousaAUpper, d.kousaALower)}</div>
                          <div>B {fmtK(d.kousaBUpper, d.kousaBLower)}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-[10px] text-gray-600 text-center border-r border-gray-200">
                          {d.mentori4 != null ? `4C:${Number(d.mentori4)}` : "4C:—"}<br />
                          {d.mentori8 != null ? `8C:${Number(d.mentori8)}` : "8C:—"}
                        </td>
                        <td className="px-3 py-2 text-right border-r border-gray-200">{d.quantity}</td>
                        <td className="px-3 py-2 text-right border-r border-gray-200">¥{Number(d.unitPrice ?? 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-semibold border-r border-gray-200">¥{Number(d.totalPrice ?? 0).toLocaleString()}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-center border-r border-gray-200">{d.shortestDelivery || "—"}</td>
                        <td className={`px-3 py-2 whitespace-nowrap text-center ${expired ? "text-red-600 font-bold" : "text-gray-600"}`}>
                          {deadline ? deadline.toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                          {expired && <div className="text-[10px]">⚠ 期限切れ</div>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="flex justify-end gap-3">
            <Link href={estimateId ? `/estimates/${estimateId}/edit` : "/estimates"}
              className="px-5 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
              入力画面へ戻る
            </Link>
            <button
              onClick={handleOrder}
              disabled={ordering || hasExpired}
              className={`px-6 py-2.5 text-sm rounded-lg font-medium transition-colors ${
                hasExpired
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : ordering
                    ? "bg-indigo-400 text-white cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
            >
              {ordering ? "注文処理中..." : hasExpired ? "⚠ 期限切れ明細あり（注文不可）" : "🛒 注文を確定する"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
