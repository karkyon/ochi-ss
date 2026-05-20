// src/components/ui/DraftRestoreBanner.tsx
// Draft 復元オファーバナー（ダッシュボードで表示）
//
// 動作:
//   1. マウント時に GET /api/v1/estimates/drafts を呼び出し
//   2. Draft が1件 → 「前回の入力途中データがあります」バナー
//   3. Draft が2件以上 → 「保存途中の見積データが N件あります」バナー
//   4. 同一セッションで1回のみ表示（sessionStorage フラグ）
//
// ボタン:
//   [復元して続ける] → /estimates/{id}/edit
//   [破棄する]       → DELETE /api/v1/estimates/{id}/draft → 再取得
//   [後で確認]       → sessionStorage フラグ → バナー非表示
//   [一覧を見る]     → /estimates?status=draft（複数時）

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
  if (min < 60) return `${min}分前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}時間前`
  return `${Math.floor(h / 24)}日前`
}

export default function DraftRestoreBanner() {
  const router = useRouter()
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // 同一セッションで既に「後で」を押していたら非表示
    if (sessionStorage.getItem(SESSION_FLAG)) return

    void (async () => {
      try {
        const res = await fetch("/api/v1/estimates/drafts")
        if (!res.ok) return
        const data = await res.json()
        if (data.drafts && data.drafts.length > 0) {
          setDrafts(data.drafts)
          setVisible(true)
        }
      } catch {
        // ネットワークエラーはサイレント
      }
    })()
  }, [])

  const handleRestore = (estimateId: string) => {
    router.push(`/estimates/${estimateId}/edit`)
  }

  const handleDiscard = async (estimateId: string) => {
    setLoading(true)
    try {
      await fetch(`/api/v1/estimates/${estimateId}/draft`, { method: "DELETE" })
      const newDrafts = drafts.filter(d => d.estimateId !== estimateId)
      setDrafts(newDrafts)
      if (newDrafts.length === 0) setVisible(false)
    } catch {
      // エラー時はバナーを閉じる
      setVisible(false)
    } finally {
      setLoading(false)
    }
  }

  const handleLater = () => {
    sessionStorage.setItem(SESSION_FLAG, "1")
    setVisible(false)
  }

  const handleDiscardAll = async () => {
    setLoading(true)
    try {
      await Promise.all(
        drafts.map(d =>
          fetch(`/api/v1/estimates/${d.estimateId}/draft`, { method: "DELETE" })
        )
      )
    } catch { /* ignore */ }
    setVisible(false)
    setLoading(false)
  }

  if (!visible || drafts.length === 0) return null

  // 複数 Draft の場合
  if (drafts.length > 1) {
    return (
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-xl">📋</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-800">
              保存途中の見積データが {drafts.length} 件あります
            </p>
            <div className="mt-2 space-y-1">
              {drafts.map((d, i) => (
                <div key={d.estimateId} className="text-xs text-blue-700">
                  {i + 1}. {d.destinationName ?? "（送り先未入力）"} — 明細 {d.detailCount} 件 — {relativeTime(d.draftSavedAt)}
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2 flex-wrap">
              <button
                onClick={() => router.push("/estimates?status=draft")}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
              >
                一覧を見る →
              </button>
              <button
                onClick={handleDiscardAll}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-xs hover:bg-gray-100 disabled:opacity-50"
              >
                全て破棄
              </button>
              <button
                onClick={handleLater}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600"
              >
                後で確認
              </button>
            </div>
          </div>
          <button onClick={handleLater} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>
      </div>
    )
  }

  // 1件の場合
  const d = drafts[0]
  return (
    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-xl">📋</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-800">
            前回の入力途中データがあります
          </p>
          <p className="mt-1 text-xs text-blue-700">
            送り先：{d.destinationName ?? "（未入力）"} &nbsp;|&nbsp;
            明細 {d.detailCount} 件 &nbsp;|&nbsp;
            {relativeTime(d.draftSavedAt)}に自動保存
          </p>
          <div className="mt-3 flex gap-2 flex-wrap">
            <button
              onClick={() => handleRestore(d.estimateId)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
            >
              ✅ 復元して続ける
            </button>
            <button
              onClick={() => handleDiscard(d.estimateId)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-red-300 text-red-600 text-xs hover:bg-red-50 disabled:opacity-50"
            >
              🗑 破棄する
            </button>
            <button
              onClick={handleLater}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600"
            >
              後で確認
            </button>
          </div>
        </div>
        <button onClick={handleLater} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
      </div>
    </div>
  )
}
