"use client"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function OrderCancelButton({ orderId, orderNo }: { orderId: string; orderNo: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleCancel = async () => {
    if (!confirm(`注文 ${orderNo} をキャンセルしますか？\nキャンセル後は取り消せません。`)) return
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/cancel`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "キャンセル失敗")
      router.refresh()
    } catch (e: any) {
      alert(`エラー: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "処理中..." : "🚫 注文キャンセル"}
    </button>
  )
}
