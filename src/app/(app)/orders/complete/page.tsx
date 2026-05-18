// /orders/complete — 注文完了ページ
"use client"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

export default function OrderCompletePage() {
  const sp = useSearchParams()
  const orderId = sp.get("orderId")

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">ご注文ありがとうございます</h1>
        <p className="text-gray-500 mb-8">注文を承りました。確認後、担当者よりご連絡いたします。</p>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-8 text-sm text-blue-800">
          <p className="font-semibold mb-1">お問い合わせ先</p>
          <p>越智製作所　TEL: 072-882-5524</p>
          <p>E-mail: weborder@ochi-ss.co.jp</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {orderId && (
            <Link
              href={`/orders/${orderId}`}
              className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm"
            >
              注文詳細を確認
            </Link>
          )}
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-lg bg-[#1a2744] text-white hover:bg-[#243561] transition-colors text-sm"
          >
            メインメニューへ
          </Link>
        </div>
      </div>
    </div>
  )
}
