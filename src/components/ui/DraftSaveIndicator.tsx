// src/components/ui/DraftSaveIndicator.tsx
// Draft 自動保存ステータスインジケーター
//
// 使い方:
//   <DraftSaveIndicator status={saveStatus} savedAt={savedAt} />
//
// 表示パターン:
//   idle    → 非表示
//   saving  → ⏳ 自動保存中...
//   saved   → ✓ 自動保存済み HH:MM:SS
//   error   → ⚠ 自動保存失敗（クリックで再試行）

"use client"

import type { DraftSaveStatus } from "@/hooks/useDraftAutoSave"

interface Props {
  status: DraftSaveStatus
  savedAt: Date | null
  onRetry?: () => void
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export default function DraftSaveIndicator({ status, savedAt, onRetry }: Props) {
  if (status === "idle") return null

  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400 animate-pulse">
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        自動保存中...
      </span>
    )
  }

  if (status === "saved" && savedAt) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        自動保存済み {formatTime(savedAt)}
      </span>
    )
  }

  if (status === "error") {
    return (
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 underline"
        type="button"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        自動保存失敗 – 再試行
      </button>
    )
  }

  return null
}
