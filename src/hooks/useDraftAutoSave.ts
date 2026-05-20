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
