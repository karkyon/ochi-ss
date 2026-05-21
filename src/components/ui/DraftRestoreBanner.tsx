"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

interface DraftItem {
  estimateId: string
  destinationName: string | null
  detailCount: number
  draftSavedAt: string | null
  draftExpiresAt: string | null
}
const SESSION_FLAG = "ochi_draft_banner_dismissed"

function relativeTime(iso: string | null): string {
  if (!iso) return "不明"
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "たった今"
  if (min < 60) return min + "分前"
  const h = Math.floor(min / 60)
  if (h < 24) return h + "時間前"
  return Math.floor(h / 24) + "日前"
}

export default function DraftRestoreBanner() {
  const router = useRouter()
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const dismissed = sessionStorage.getItem(SESSION_FLAG)
    if (dismissed) return
    void (async () => {
      try {
        console.log("[DraftRestoreBanner] drafts API 呼び出し中...")
        const res = await fetch("/api/v1/estimates/drafts")
        console.log("[DraftRestoreBanner] API status:", res.status)
        if (!res.ok) return
        const data = await res.json()
        console.log("[DraftRestoreBanner] drafts件数:", data.drafts?.length ?? 0)
        if (data.drafts && data.drafts.length > 0) {
          setDrafts(data.drafts)
          setVisible(true)
        }
      } catch (e) {
        console.warn("[DraftRestoreBanner] エラー:", e)
      }
    })()
  }, [])

  const handleLater = () => {
    sessionStorage.setItem(SESSION_FLAG, "1")
    setVisible(false)
  }
  const handleRestore = (id: string) => router.push("/estimates/" + id + "/edit")
  const handleDiscard = async (id: string) => {
    setLoading(true)
    try {
      await fetch("/api/v1/estimates/" + id + "/draft", { method: "DELETE" })
      const next = drafts.filter(d => d.estimateId !== id)
      setDrafts(next)
      if (next.length === 0) setVisible(false)
    } catch {
      setVisible(false)
    } finally {
      setLoading(false)
    }
  }

  if (!visible || drafts.length === 0) return null

  return (
    <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "8px", padding: "10px 14px", marginBottom: "14px", display: "flex", gap: "10px", alignItems: "flex-start" }}>
      <span style={{ fontSize: "18px", flexShrink: 0 }}>📝</span>
      <div style={{ flex: 1 }}>
        {drafts.length === 1 ? (
          <>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#9a3412" }}>前回の入力途中データがあります</div>
            <div style={{ fontSize: "11px", color: "#78350f", marginTop: "2px" }}>
              {drafts[0].destinationName ?? "（送り先未入力）"} | 明細 {drafts[0].detailCount}件 | {relativeTime(drafts[0].draftSavedAt)}に自動保存
            </div>
            <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
              <button
                onClick={() => handleRestore(drafts[0].estimateId)}
                style={{ background: "#1d4ed8", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 12px", fontSize: "11px", cursor: "pointer", fontWeight: 500 }}
              >
                ✅ 復元して続ける
              </button>
              <button
                onClick={() => handleDiscard(drafts[0].estimateId)}
                disabled={loading}
                style={{ background: "#fff", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: "4px", padding: "4px 12px", fontSize: "11px", cursor: "pointer" }}
              >
                🗑 破棄する
              </button>
              <button
                onClick={handleLater}
                style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "11px", cursor: "pointer" }}
              >
                後で確認
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#9a3412" }}>
              保存途中の見積データが{drafts.length}件あります
            </div>
            <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
              <a
                href="/estimates?status=draft"
                style={{ background: "#1d4ed8", color: "#fff", borderRadius: "4px", padding: "4px 12px", fontSize: "11px", textDecoration: "none", fontWeight: 500 }}
              >
                一覧を見る →
              </a>
              <button
                onClick={handleLater}
                style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "11px", cursor: "pointer" }}
              >
                後で確認
              </button>
            </div>
          </>
        )}
      </div>
      <button
        onClick={handleLater}
        style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "16px", cursor: "pointer", flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  )
}
