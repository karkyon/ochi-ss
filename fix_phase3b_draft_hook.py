#!/usr/bin/env python3
# =============================================================
#  fix_phase3b_draft_hook.py
#  Phase 3-B: フロントエンド Draft 自動保存システム
#  Task 3-2-1: useDraftAutoSave Hook
#  Task 3-2-2: DraftSaveIndicator コンポーネント
#  Task 3-3-1: DraftRestoreBanner コンポーネント
#  Task 3-4-1: auth.ts signOut Draft期限切れ処理
#  Task 3-4-2: scripts/cleanup-expired-drafts.ts
#  Task 3-2-4: EstimateNewClient に Hook 統合
#  Task 3-2-5: EstimateEditClient に Hook 統合
#  Task 3-3-2: dashboard/page.tsx にバナー追加
# =============================================================

import os, re, subprocess, sys

ROOT = os.path.expanduser("~/projects/ochi-ss")

def write(path, content):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    existed = os.path.exists(full)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    tag = "上書き" if existed else "新規作成"
    print(f"  ✅ [{tag}] {path}")

def read(path):
    full = os.path.join(ROOT, path)
    with open(full, "r", encoding="utf-8") as f:
        return f.read()

def patch(path, old, new, label):
    full = os.path.join(ROOT, path)
    content = read(path)
    if old in content:
        with open(full, "w", encoding="utf-8") as f:
            f.write(content.replace(old, new, 1))
        print(f"  ✅ [{label}] 適用")
        return True
    else:
        print(f"  ⚠️  [{label}] 対象文字列未発見（既適用か確認）")
        return False

print("=" * 60)
print("  fix_phase3b_draft_hook.py")
print("  Phase 3-B: フロントエンド Draft 自動保存システム")
print("=" * 60)

# ─────────────────────────────────────────────────────────────
# ① useDraftAutoSave カスタム Hook
# ─────────────────────────────────────────────────────────────
print("\n[Task 3-2-1] useDraftAutoSave Hook")

HOOK = """\
// src/hooks/useDraftAutoSave.ts
// Draft 自動保存カスタム Hook
//
// 使い方:
//   const { draftId, savedAt, saveStatus, triggerSave } = useDraftAutoSave(initialDraftId)
//   // ヘッダーや明細が変化したら triggerSave(headerData, details) を呼ぶ
//
// 保存タイミング:
//   - 30秒 debounce（連続入力中は待機）
//   - onBlur（フィールドを離れた時）→ triggerSave を即時呼び出し
//   - 明細追加時 → triggerSave を即時呼び出し
//   - beforeunload（saving 中のみ警告）

"use client"

import { useState, useCallback, useEffect, useRef } from "react"

export type DraftSaveStatus = "idle" | "saving" | "saved" | "error"

interface HeaderPartial {
  inputDate?: string
  estimateDate?: string
  chargeName?: string
  customerOrderNo?: string
  endUserNo?: string
  destinationCode?: string
  destinationName?: string
  destinationDept?: string
  destinationPerson?: string
  destinationZip?: string
  destinationAddress?: string
  destinationTel?: string
  destinationFax?: string
  requestNouki?: string
  remarks?: string
}

interface DetailItem {
  materialCode?: string
  kakouShiyouCode?: number
  kakouShijiCodeT?: string
  kakouShijiCodeA?: string
  kakouShijiCodeB?: string
  sizeT?: number | null
  sizeA?: number | null
  sizeB?: number | null
  kousaTUpper?: number | null
  kousaTLower?: number | null
  kousaAUpper?: number | null
  kousaALower?: number | null
  kousaBUpper?: number | null
  kousaBLower?: number | null
  mentori4?: number | null
  mentori8?: number | null
  quantity?: number
  unitPrice?: number | null
  totalPrice?: number | null
  shortestDelivery?: string | null
  deliveryDeadline?: string | null
}

const DEBOUNCE_MS = 30_000 // 30秒

export function useDraftAutoSave(initialDraftId: string | null = null) {
  const [draftId, setDraftId] = useState<string | null>(initialDraftId)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>("idle")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestDataRef = useRef<{ header: HeaderPartial; details: DetailItem[] } | null>(null)
  const draftIdRef = useRef<string | null>(initialDraftId)

  // draftId が変わったら ref も更新
  useEffect(() => {
    draftIdRef.current = draftId
  }, [draftId])

  const doSave = useCallback(async (header: HeaderPartial, details: DetailItem[]) => {
    setSaveStatus("saving")
    try {
      if (!draftIdRef.current) {
        // 初回: POST
        const res = await fetch("/api/v1/estimates/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ headerPartial: header, details, isDraftOnly: true }),
        })
        if (!res.ok) throw new Error(`POST /draft failed: ${res.status}`)
        const data = await res.json()
        setDraftId(data.estimateId)
        draftIdRef.current = data.estimateId
      } else {
        // 2回目以降: PATCH（LWW タイムスタンプ付き）
        const res = await fetch(`/api/v1/estimates/${draftIdRef.current}/draft`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            headerPartial: header,
            details,
            draftSavedAt: savedAt?.toISOString(),
          }),
        })
        if (res.status === 409) {
          // 競合: 他端末の新しいデータが存在
          const conflict = await res.json()
          console.warn("[useDraftAutoSave] 競合検知:", conflict.message)
          setSaveStatus("error")
          return
        }
        if (!res.ok) throw new Error(`PATCH /draft failed: ${res.status}`)
      }
      const now = new Date()
      setSavedAt(now)
      setSaveStatus("saved")
    } catch (e) {
      console.error("[useDraftAutoSave] 保存エラー:", e)
      setSaveStatus("error")
    }
  }, [savedAt])

  // デバウンス付き保存トリガー
  const triggerSave = useCallback(
    (header: HeaderPartial, details: DetailItem[], immediate = false) => {
      latestDataRef.current = { header, details }
      if (timerRef.current) clearTimeout(timerRef.current)
      if (immediate) {
        void doSave(header, details)
      } else {
        timerRef.current = setTimeout(() => {
          if (latestDataRef.current) {
            void doSave(latestDataRef.current.header, latestDataRef.current.details)
          }
        }, DEBOUNCE_MS)
      }
    },
    [doSave]
  )

  // beforeunload: saving 中のみ警告
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveStatus === "saving") {
        e.preventDefault()
        e.returnValue = "保存中です。このページを離れると変更が失われる可能性があります。"
      }
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [saveStatus])

  // アンマウント時にタイマークリア
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { draftId, savedAt, saveStatus, triggerSave }
}
"""

write("src/hooks/useDraftAutoSave.ts", HOOK)

# ─────────────────────────────────────────────────────────────
# ② DraftSaveIndicator コンポーネント
# ─────────────────────────────────────────────────────────────
print("\n[Task 3-2-2] DraftSaveIndicator コンポーネント")

INDICATOR = """\
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
"""

write("src/components/ui/DraftSaveIndicator.tsx", INDICATOR)

# ─────────────────────────────────────────────────────────────
# ③ DraftRestoreBanner コンポーネント
# ─────────────────────────────────────────────────────────────
print("\n[Task 3-3-1] DraftRestoreBanner コンポーネント")

BANNER = """\
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
"""

write("src/components/ui/DraftRestoreBanner.tsx", BANNER)

# ─────────────────────────────────────────────────────────────
# ④ auth.ts に signOut Draft 期限切れ処理追加
# ─────────────────────────────────────────────────────────────
print("\n[Task 3-4-1] auth.ts signOut Draft 期限切れ処理")

AUTH_FILE = "src/lib/auth.ts"
auth_content = read(AUTH_FILE)

# events.signOut を追加 — callbacks の直後に追記
# 既に events があるかチェック
if "events:" in auth_content:
    print("  ℹ️  events: が既に存在（signOut 処理を追記）")
    # signOut が既にある場合はスキップ
    if "signOut" in auth_content and "draftExpiresAt" in auth_content:
        print("  ℹ️  Draft 期限切れ処理は既に実装済み（スキップ）")
    else:
        patch(
            AUTH_FILE,
            "events: {",
            """events: {
    async signOut(message: { session?: { user?: { customerId?: string } } }) {
      // ログアウト時に Draft を即時期限切れ（PC共有対策）
      try {
        const customerId = (message as any)?.session?.user?.customerId
          ?? (message as any)?.token?.customerId
        if (customerId) {
          const { prisma } = await import("@/lib/prisma")
          await prisma.estimateHeader.updateMany({
            where: {
              customerId,
              estimateStatus: "draft",
              isDraftOnly:    true,
              isDeleted:      false,
            },
            data: { draftExpiresAt: new Date() },
          })
        }
      } catch (e) {
        console.error("[auth signOut] Draft 期限切れ処理エラー:", e)
      }
    },""",
            "auth.ts signOut Draft 期限切れ",
        )
else:
    # events: ブロックを追加（callbacks の閉じカッコ直後）
    old = "  callbacks: {"
    new_section = """  events: {
    async signOut(message: Record<string, unknown>) {
      // ログアウト時に Draft を即時期限切れ（PC共有対策）
      try {
        const customerId = (message as any)?.session?.user?.customerId
          ?? (message as any)?.token?.customerId
        if (customerId) {
          const { prisma } = await import("@/lib/prisma")
          await prisma.estimateHeader.updateMany({
            where: {
              customerId,
              estimateStatus: "draft",
              isDraftOnly:    true,
              isDeleted:      false,
            },
            data: { draftExpiresAt: new Date() },
          })
        }
      } catch (e) {
        console.error("[auth signOut] Draft 期限切れ処理エラー:", e)
      }
    },
  },
  callbacks: {"""
    patch(AUTH_FILE, old, new_section, "auth.ts events+signOut 追加")

# ─────────────────────────────────────────────────────────────
# ⑤ cleanup-expired-drafts.ts バッチスクリプト
# ─────────────────────────────────────────────────────────────
print("\n[Task 3-4-2] scripts/cleanup-expired-drafts.ts")

CLEANUP = """\
// scripts/cleanup-expired-drafts.ts
// 有効期限切れ Draft のソフトデリートバッチ
//
// 実行方法:
//   npx ts-node --project tsconfig.json scripts/cleanup-expired-drafts.ts
//
// cron（毎日0時）:
//   0 0 * * * cd /app && npx ts-node scripts/cleanup-expired-drafts.ts >> /var/log/cleanup-drafts.log 2>&1

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const now = new Date()
  console.log(`[cleanup-expired-drafts] 開始: ${now.toISOString()}`)

  const result = await prisma.estimateHeader.updateMany({
    where: {
      estimateStatus: "draft",
      isDraftOnly:    true,
      isDeleted:      false,
      draftExpiresAt: { lt: now },
    },
    data: { isDeleted: true },
  })

  console.log(`[cleanup-expired-drafts] ソフトデリート件数: ${result.count}`)
  console.log(`[cleanup-expired-drafts] 完了: ${new Date().toISOString()}`)
}

main()
  .catch((e) => {
    console.error("[cleanup-expired-drafts] エラー:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
"""

write("scripts/cleanup-expired-drafts.ts", CLEANUP)

# ─────────────────────────────────────────────────────────────
# ⑥ EstimateNewClient に useDraftAutoSave 統合
# ─────────────────────────────────────────────────────────────
print("\n[Task 3-2-4] EstimateNewClient に useDraftAutoSave 統合")

NEW_CLIENT_FILE = "src/app/(app)/estimates/new/EstimateNewClient.tsx"

# import 追加
patch(
    NEW_CLIENT_FILE,
    'import { useState, useCallback, useEffect } from "react"',
    'import { useState, useCallback, useEffect } from "react"\nimport { useDraftAutoSave } from "@/hooks/useDraftAutoSave"\nimport DraftSaveIndicator from "@/components/ui/DraftSaveIndicator"',
    "NewClient: import useDraftAutoSave + DraftSaveIndicator",
)

# Hook 初期化（useEffect の直前、cuttingMethods state の後）
patch(
    NEW_CLIENT_FILE,
    "  // ヘッダーフォーム\n  const [header, setHeader]",
    """  // Draft 自動保存 Hook
  const { draftId: _draftId, savedAt, saveStatus, triggerSave } = useDraftAutoSave(null)

  // ヘッダーフォーム
  const [header, setHeader]""",
    "NewClient: useDraftAutoSave Hook 初期化",
)

# ヘッダー変更時に triggerSave を呼ぶ（setHeader のラッパー）
patch(
    NEW_CLIENT_FILE,
    "  // 明細リスト\n  const [details, setDetails]",
    """  // ヘッダー変更時に自動保存トリガー
  const handleHeaderChange = useCallback((updater: (h: HeaderForm) => HeaderForm) => {
    setHeader(prev => {
      const next = updater(prev)
      triggerSave(next, details)
      return next
    })
  }, [details, triggerSave])

  // 明細リスト
  const [details, setDetails]""",
    "NewClient: handleHeaderChange 追加",
)

# 明細追加時に即時保存トリガー（handleAddDetail の末尾）
patch(
    NEW_CLIENT_FILE,
    "    setDetails(prev => [...prev, newDetail])\n    setCalcResult(null)",
    "    setDetails(prev => {\n      const next = [...prev, newDetail]\n      triggerSave(header, next, true) // 明細追加時は即時保存\n      return next\n    })\n    setCalcResult(null)",
    "NewClient: 明細追加時 triggerSave 即時",
)

# DraftSaveIndicator を保存ボタン付近に追加
patch(
    NEW_CLIENT_FILE,
    "      {/* 保存・注文ボタン */}\n          <div",
    """      {/* Draft 自動保存インジケーター */}
          <div className="px-5 pt-3 flex justify-end">
            <DraftSaveIndicator
              status={saveStatus}
              savedAt={savedAt}
              onRetry={() => triggerSave(header, details, true)}
            />
          </div>

      {/* 保存・注文ボタン */}
          <div""",
    "NewClient: DraftSaveIndicator 追加",
)

# ─────────────────────────────────────────────────────────────
# ⑦ EstimateEditClient に useDraftAutoSave 統合
# ─────────────────────────────────────────────────────────────
print("\n[Task 3-2-5] EstimateEditClient に useDraftAutoSave 統合")

EDIT_CLIENT_FILE = "src/app/(app)/estimates/[id]/edit/EstimateEditClient.tsx"

patch(
    EDIT_CLIENT_FILE,
    'import { useState, useCallback, useEffect } from "react"',
    'import { useState, useCallback, useEffect } from "react"\nimport { useDraftAutoSave } from "@/hooks/useDraftAutoSave"\nimport DraftSaveIndicator from "@/components/ui/DraftSaveIndicator"',
    "EditClient: import useDraftAutoSave + DraftSaveIndicator",
)

# estimateId を Props から取得して初期 draftId として渡す
patch(
    EDIT_CLIENT_FILE,
    "export default function EstimateEditClient(",
    """export default function EstimateEditClient(""",
    "EditClient: コンポーネント確認",
)

# Hook 初期化（estimateData.estimateStatus が draft なら initialDraftId = estimateData.id）
patch(
    EDIT_CLIENT_FILE,
    "  // ヘッダーフォーム\n  const [header, setHeader]",
    """  // Draft 自動保存 Hook（Edit モードでは既存 estimateId を初期値に）
  const initialDraftId = estimateData?.isDraftOnly ? estimateData.id : null
  const { draftId: _draftIdEdit, savedAt, saveStatus, triggerSave } = useDraftAutoSave(initialDraftId)

  // ヘッダーフォーム
  const [header, setHeader]""",
    "EditClient: useDraftAutoSave Hook 初期化",
)

# 明細追加時に即時保存
patch(
    EDIT_CLIENT_FILE,
    "    setDetails(prev => [...prev, newDetail])\n    setCalcResult(null)",
    "    setDetails(prev => {\n      const next = [...prev, newDetail]\n      if (estimateData?.isDraftOnly) triggerSave(header, next, true)\n      return next\n    })\n    setCalcResult(null)",
    "EditClient: 明細追加時 triggerSave",
)

# DraftSaveIndicator 追加
patch(
    EDIT_CLIENT_FILE,
    "      {/* 保存ボタン */}\n      <div",
    """      {/* Draft 自動保存インジケーター（isDraftOnly の場合のみ表示） */}
      {estimateData?.isDraftOnly && (
        <div className="px-5 pt-3 flex justify-end">
          <DraftSaveIndicator
            status={saveStatus}
            savedAt={savedAt}
            onRetry={() => triggerSave(header, details, true)}
          />
        </div>
      )}

      {/* 保存ボタン */}
      <div""",
    "EditClient: DraftSaveIndicator 追加",
)

# ─────────────────────────────────────────────────────────────
# ⑧ dashboard/page.tsx に DraftRestoreBanner 追加
# ─────────────────────────────────────────────────────────────
print("\n[Task 3-3-2] dashboard/page.tsx に DraftRestoreBanner 追加")

DASHBOARD_FILE = "src/app/(app)/dashboard/page.tsx"

patch(
    DASHBOARD_FILE,
    "import DashboardNotificationsClient from \"./DashboardNotificationsClient\"",
    'import DashboardNotificationsClient from "./DashboardNotificationsClient"\nimport DraftRestoreBanner from "@/components/ui/DraftRestoreBanner"',
    "dashboard: import DraftRestoreBanner",
)

patch(
    DASHBOARD_FILE,
    "      {/* お知らせパネル */}\n      <DashboardNotificationsClient",
    """      {/* Draft 復元バナー */}
      <DraftRestoreBanner />

      {/* お知らせパネル */}
      <DashboardNotificationsClient""",
    "dashboard: DraftRestoreBanner 配置",
)

# ─────────────────────────────────────────────────────────────
# ⑨ tsc --noEmit
# ─────────────────────────────────────────────────────────────
print("\n[TypeScript チェック]")
result = subprocess.run(
    ["npx", "tsc", "--noEmit"],
    cwd=ROOT,
    capture_output=True,
    text=True,
)
if result.returncode == 0:
    print("  ✅ tsc --noEmit: エラーなし")
else:
    print("  ❌ tsc エラー:")
    print(result.stdout[-3000:] if len(result.stdout) > 3000 else result.stdout)
    print(result.stderr[-1000:] if len(result.stderr) > 1000 else result.stderr)
    sys.exit(1)

print("\n" + "=" * 60)
print("  Phase 3-B 完了！")
print("  次のコマンドを実行してください:")
print("  git add -A && git commit -m 'feat: Phase3-B Draft Hook・インジケーター・バナー・signOut処理'")
print("  git push")
print("=" * 60)
