#!/usr/bin/env python3
"""
fix_session14.py
================
TASK A: /orders/confirm — 納期有効期限チェック実際に実装
         estimate取得後に deliveryDeadline 期限切れ明細を検出 → 警告バナー表示 + 注文確定ボタン無効化
TASK B: /orders/confirm — 明細テーブル表示（deliveryDeadline 期限切れ行ハイライト）
TASK C: /orders/complete — orderId から注文詳細取得して表示強化
TASK D: /api/v1/orders/route.ts POST — estimateId から customerId 取得して権限確認強化
"""

import subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def read(p): return (ROOT / p).read_text(encoding="utf-8")
def write(p, c):
    path = ROOT / p; path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(c, encoding="utf-8"); print(f"  ✅ 書込: {p}")

def rep(p, old, new, label):
    path = ROOT / p
    if not path.exists(): print(f"  ⚠️  [{label}] ファイル未存在"); return False
    c = path.read_text(encoding="utf-8")
    if old not in c: print(f"  ❌ [{label}] アンカー未発見"); return False
    path.write_text(c.replace(old, new, 1), encoding="utf-8"); print(f"  ✅ [{label}]"); return True

# ============================================================
# TASK A+B: /orders/confirm 完全書き直し
# ============================================================
def task_ab():
    print("\n[TASK A+B] /orders/confirm 納期有効期限チェック+明細表示 完全実装")
    write("src/app/(app)/orders/confirm/page.tsx", '''\
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
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["No","材料","寸法T×A×B","数量","単価","合計","最短納期","納期有効期限"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(estimate.details ?? []).map((d: any) => {
                    const expired = expiredRows.includes(d.rowNo)
                    const deadline = d.deliveryDeadline ? new Date(d.deliveryDeadline) : null
                    return (
                      <tr key={d.rowNo} className={expired ? "bg-amber-50" : "hover:bg-gray-50"}>
                        <td className="px-3 py-2 text-center font-medium">
                          {d.rowNo}
                          {expired && <span className="ml-1 text-amber-600">⚠</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{d.materialName || d.materialCode}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono">
                          {Number(d.sizeT)}×{Number(d.sizeA)}×{Number(d.sizeB)}
                        </td>
                        <td className="px-3 py-2 text-right">{d.quantity}</td>
                        <td className="px-3 py-2 text-right">¥{Number(d.unitPrice ?? 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-medium">¥{Number(d.totalPrice ?? 0).toLocaleString()}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{d.shortestDelivery || "—"}</td>
                        <td className={`px-3 py-2 whitespace-nowrap ${expired ? "text-amber-700 font-semibold" : "text-gray-500"}`}>
                          {deadline ? deadline.toLocaleDateString("ja-JP") : "—"}
                          {expired && " (期限切れ)"}
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
''')

# ============================================================
# TASK C: /orders/complete — orderId から注文詳細表示強化
# ============================================================
def task_c():
    print("\n[TASK C] /orders/complete 表示強化")
    path = "src/app/(app)/orders/complete/page.tsx"
    content = read(path)
    if "orderId" in content and "fetch" in content:
        print("  ⏭️  既に実装済み — スキップ")
        return

    write(path, '''\
// /orders/complete — 注文完了ページ
"use client"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

export default function OrderCompletePage() {
  const sp = useSearchParams()
  const orderId = sp.get("orderId")
  const [order, setOrder] = useState<any>(null)

  useEffect(() => {
    if (!orderId) return
    fetch(`/api/v1/orders/${orderId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setOrder(d))
      .catch(() => {})
  }, [orderId])

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* 完了アイコン */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✅</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">ご注文ありがとうございます</h1>
        <p className="text-sm text-gray-500">注文を受け付けました。内容をご確認ください。</p>
      </div>

      {/* 注文サマリ */}
      {order && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">注文内容</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">注文No</p>
              <p className="font-bold text-indigo-700 text-base">{order.order?.orderNo ?? order.orderNo ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">注文日時</p>
              <p className="font-medium">{order.order?.orderDate
                ? new Date(order.order.orderDate).toLocaleDateString("ja-JP")
                : order.orderDate
                  ? new Date(order.orderDate).toLocaleDateString("ja-JP")
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">見積No</p>
              <p className="font-medium">{order.estimateHeader?.estimateNo ?? order.estimateNo ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">明細件数</p>
              <p className="font-medium">{order.details?.length ?? order.detailCount ?? "—"} 件</p>
            </div>
          </div>
        </div>
      )}

      {!order && orderId && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 text-center text-gray-400 text-sm">
          注文番号: {orderId}
        </div>
      )}

      {/* アクション */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {orderId && (
          <Link href={`/orders/${orderId}`}
            className="px-5 py-2.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-center font-medium">
            注文詳細を確認
          </Link>
        )}
        <Link href="/orders"
          className="px-5 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-center">
          注文履歴一覧へ
        </Link>
        <Link href="/dashboard"
          className="px-5 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-center">
          メインメニューへ
        </Link>
      </div>
    </div>
  )
}
''')

# ============================================================
# メイン
# ============================================================
def main():
    print("=" * 60)
    print("fix_session14.py 開始")
    print("=" * 60)
    task_ab()
    task_c()

    print("\n→ tscチェック中...")
    result = subprocess.run(["npx", "tsc", "--noEmit"], capture_output=True, text=True, cwd=str(ROOT))
    if result.returncode != 0:
        print("❌ tscエラー:")
        print((result.stdout + result.stderr)[-6000:])
        sys.exit(1)

    print("✅ tscエラーなし → git add & push")
    subprocess.run(["git", "add", "-A"], check=True, cwd=str(ROOT))
    subprocess.run(["git", "commit", "-m",
        "feat: orders/confirm 納期有効期限チェック+明細表示完全実装 / orders/complete 表示強化"],
        check=True, cwd=str(ROOT))
    subprocess.run(["git", "push"], check=True, cwd=str(ROOT))
    print("✅ push完了")

if __name__ == "__main__":
    main()
