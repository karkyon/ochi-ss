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
              <p className="font-bold text-indigo-700 text-base">{order.orderNo ?? order.order?.orderNo ?? "—"}</p>
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
