"use client"
// お知らせ返信フォーム
import { useState } from "react"

export default function NotificationReplyClient({ notificationId }: { notificationId: string }) {
  const [body, setBody]     = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent]     = useState(false)
  const [error, setError]   = useState("")

  const handleSend = async () => {
    if (!body.trim()) { setError("返信内容を入力してください"); return }
    setSending(true); setError("")
    try {
      const res = await fetch(`/api/v1/notifications/${notificationId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "送信失敗") }
      setSent(true); setBody("")
    } catch (e: any) {
      setError(e.message)
    } finally { setSending(false) }
  }

  if (sent) return (
    <div className="mt-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
      ✅ 返信を送信しました
    </div>
  )

  return (
    <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">返信フォーム</p>
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="返信内容を入力..."
        rows={4}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a2744]/30 resize-none"
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      <div className="flex justify-end mt-3">
        <button onClick={handleSend} disabled={sending}
          className="px-5 py-2 text-sm bg-[#1a2744] text-white rounded-lg hover:bg-[#1a3a6e] disabled:opacity-50 font-medium">
          {sending ? "送信中..." : "📨 返信を送信"}
        </button>
      </div>
    </div>
  )
}
