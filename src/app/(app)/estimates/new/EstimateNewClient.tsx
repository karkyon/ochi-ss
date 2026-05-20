"use client"
import { formatDimension } from "@/lib/formatNumber"
import { useState, useCallback, useEffect } from "react"
import { useDraftAutoSave } from "@/hooks/useDraftAutoSave"
import DraftSaveIndicator from "@/components/ui/DraftSaveIndicator"


// ──────────────────────────────────────────────────────────────────
// 直送先検索モーダルコンポーネント
// ──────────────────────────────────────────────────────────────────
interface DirectDelivery {
  deliveryCode:   string
  name:           string
  furigana:       string
  shortName:      string
  departmentName: string
  chargeName:     string
  postalCode:     string
  address1:       string
  address2:       string
  address3:       string
  tel:            string
  fax:            string
}

interface DirectDeliveryModalProps {
  customerCode: string
  onSelect: (dd: DirectDelivery) => void
  onClose:  () => void
}

function DirectDeliveryModal({ customerCode, onSelect, onClose }: DirectDeliveryModalProps) {
  const [query,    setQuery]    = useState("")
  const [results,  setResults]  = useState<DirectDelivery[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")
  const [searched, setSearched] = useState(false)

  const handleSearch = async () => {
    console.log("[直送先モーダル] 検索 query:", query)
    if (query.trim().length < 2) { setError("2文字以上入力してください"); return }
    setError(""); setLoading(true)
    try {
      const res = await fetch(`/api/v1/direct-deliveries/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      console.log("[直送先モーダル] 検索レスポンス:", data)
      if (!res.ok) throw new Error(data.error ?? "検索失敗")
      setResults(data.results ?? [])
      setSearched(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (dd: DirectDelivery) => {
    console.log("[直送先モーダル] 選択:", dd)
    onSelect(dd)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>

        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">🔍 直送先検索</h2>
          <button
            onClick={() => { console.log("[直送先モーダル] ×ボタン"); onClose() }}
            className="text-gray-400 hover:text-gray-700 text-xl font-bold leading-none px-1"
          >×</button>
        </div>

        {/* 検索フォーム */}
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => { console.log("[直送先モーダル] 入力:", e.target.value); setQuery(e.target.value) }}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="直送先名・コード・住所・電話番号（2文字以上）"
              autoFocus
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => { console.log("[直送先モーダル] 検索ボタン"); handleSearch() }}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? "検索中..." : "🔍 検索"}
            </button>
            <button
              onClick={() => { console.log("[直送先モーダル] クリアボタン"); setQuery(""); setResults([]); setSearched(false); setError("") }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100"
            >クリア</button>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">⚠ {error}</p>}
        </div>

        {/* 検索結果 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!searched && (
            <p className="text-sm text-gray-400 text-center py-8">検索条件を入力して「検索」ボタンを押してください</p>
          )}
          {searched && results.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">該当する直送先が見つかりませんでした</p>
          )}
          {results.length > 0 && (
            <>
              <p className="text-xs text-gray-500 mb-3">{results.length}件見つかりました</p>
              <div className="space-y-2">
                {results.map((dd, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3 hover:bg-blue-50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{dd.deliveryCode}</span>
                          <span className="text-sm font-semibold text-gray-800 truncate">{dd.name}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {dd.departmentName && <span className="mr-3">部署: {dd.departmentName}</span>}
                          {dd.chargeName     && <span className="mr-3">担当: {dd.chargeName}</span>}
                          {dd.postalCode     && <span className="mr-3">〒{dd.postalCode}</span>}
                          <span>{[dd.address1, dd.address2, dd.address3].filter(Boolean).join("")}</span>
                          {dd.tel            && <span className="ml-3">☎ {dd.tel}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleSelect(dd)}
                        className="shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                      >選択</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* フッター */}
        <div className="px-5 py-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100"
          >閉じる</button>
        </div>
      </div>
    </div>
  )
}


// ────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────

type Material = { materialCode: string; materialName: string }
type ProcessingSpec = { processingSpecCode: number; processingSpecName: string }

// 加工指示の選択肢
type CuttingMethod = { code: number; label: string }

type EstimateDetail = {
  clientDetailId: string  // クライアント側UUID
  rowNo: number
  materialCode: string
  materialName: string
  kakouShiyouCode: number
  kakouShiyou: string
  kakouShijiCodeT: string
  kakouShijiCodeA: string
  kakouShijiCodeB: string
  kakouT: string
  kakouA: string
  kakouB: string
  sizeT: string
  sizeA: string
  sizeB: string
  kousaTUpper: string; kousaTLower: string
  kousaAUpper: string; kousaALower: string
  kousaBUpper: string; kousaBLower: string
  mentori4: string; mentori8: string
  quantity: string
  // 計算結果
  unitPrice: number | null
  totalPrice: number | null
  shortestDelivery: string | null
  deliveryDeadline: string | null
  calculated: boolean
  // ▼ 追加: 計算中間値（保存時にDBへ送る）
  intermediate: {
    materialSizeT: number
    materialSizeA: number
    materialSizeB: number
    materialUnitWeight: number
    materialTotalWeight: number
    productUnitWeight: number
    productTotalWeight: number
    processingCost6f: number
    processingCostTotal: number
  } | null
}

type HeaderForm = {
  inputDate: string
  estimateDate: string
  chargeName: string
  customerOrderNo: string
  endUserNo: string
  destinationCode: string
  destinationName: string
  destinationDept: string
  destinationPerson: string
  destinationZip: string
  destinationAddress: string
  destinationTel: string
  destinationFax: string
  requestNouki: string
  remarks: string
}

type DetailForm = Omit<EstimateDetail,
  "clientDetailId" | "rowNo" | "materialName" | "kakouShiyou" |
  "kakouT" | "kakouA" | "kakouB" |
  "unitPrice" | "totalPrice" | "shortestDelivery" | "deliveryDeadline" | "calculated" | "intermediate"
>

// ────────────────────────────────────────────────
// 初期値
// ────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const EMPTY_DETAIL_FORM: DetailForm = {
  materialCode: "",
  kakouShiyouCode: 0,
  kakouShijiCodeT: "", kakouShijiCodeA: "", kakouShijiCodeB: "",
  sizeT: "", sizeA: "", sizeB: "",
  kousaTUpper: "", kousaTLower: "",
  kousaAUpper: "", kousaALower: "",
  kousaBUpper: "", kousaBLower: "",
  mentori4: "", mentori8: "",
  quantity: "",
}

// ────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────

interface CopySourceDetail {
  materialCode: string
  materialName: string
  kakouShiyouCode: number
  kakouShiyou: string
  kakouShijiCodeT: string
  kakouShijiCodeA: string
  kakouShijiCodeB: string
  kakouT: string
  kakouA: string
  kakouB: string
  sizeT: number
  sizeA: number
  sizeB: number
  kousaTUpper: number | null
  kousaTLower: number | null
  kousaAUpper: number | null
  kousaALower: number | null
  kousaBUpper: number | null
  kousaBLower: number | null
  mentori4: number | null
  mentori8: number | null
  quantity: number
  unitPrice: number | null
  totalPrice: number | null
  shortestDelivery: string
  deliveryDeadline: string | null
}

interface CopySource {
  customerOrderNo: string
  endUserNo: string
  destinationCode: string
  destinationName: string
  destinationDept: string
  destinationPerson: string
  destinationZip: string
  destinationAddress: string
  destinationTel: string
  destinationFax: string
  remarks: string
  details: CopySourceDetail[]
}

interface Props {
  materials: Material[]
  processingSpecs: ProcessingSpec[]
  userInfo: {
    customerCode: string
    customerName: string
    chargeName: string
    userId: string
  }
  copySource?: CopySource | null
}

export default function EstimateNewClient({ materials, processingSpecs, userInfo, copySource }: Props) {
  // 加工指示マスタ（SQL Serverからバインド）
  const [cuttingMethods, setCuttingMethods] = useState<CuttingMethod[]>([])
  
  useEffect(() => {
    fetch(`/api/v1/cutting-methods?customerCode=${userInfo.customerCode}`)
      .then(r => r.json())
      .then(data => {
        console.log('[加工指示API] レスポンス:', data)
        if (data.methods) setCuttingMethods(data.methods)
      })
      .catch((e) => { console.error('[加工指示API] エラー:', e) })
  }, [userInfo.customerCode])

  // Draft 自動保存 Hook
  const { draftId: _draftId, savedAt, saveStatus, triggerSave } = useDraftAutoSave(null)

  // ヘッダーフォーム
  const [header, setHeader] = useState<HeaderForm>({
    inputDate:          todayStr(),
    estimateDate:       todayStr(),
    chargeName:         userInfo.chargeName ?? "",
    customerOrderNo:    copySource?.customerOrderNo ?? "",
    endUserNo:          copySource?.endUserNo ?? "",
    destinationCode:    copySource?.destinationCode ?? "",
    destinationName:    copySource?.destinationName ?? "",
    destinationDept:    copySource?.destinationDept ?? "",
    destinationPerson:  copySource?.destinationPerson ?? "",
    destinationZip:     copySource?.destinationZip ?? "",
    destinationAddress: copySource?.destinationAddress ?? "",
    destinationTel:     copySource?.destinationTel ?? "",
    destinationFax:     copySource?.destinationFax ?? "",
    requestNouki:       "",
    remarks:            copySource?.remarks ?? "",
  })
  const [showDDModal, setShowDDModal] = useState(false)

  // 明細入力フォーム（1行分）
  const [detailForm, setDetailForm] = useState<DetailForm>(EMPTY_DETAIL_FORM)

  // 計算結果（計算ボタン押下後）
  // ▼ 変更: sumPrice → totalPrice にマッピング。intermediate を追加
  const [calcResult, setCalcResult] = useState<{
    unitPrice: number
    totalPrice: number
    shortestDelivery: string
    deliveryDeadline: string
    intermediate: {
      materialSizeT: number
      materialSizeA: number
      materialSizeB: number
      materialUnitWeight: number
      materialTotalWeight: number
      productUnitWeight: number
      productTotalWeight: number
      processingCost6f: number
      processingCostTotal: number
    } | null
  } | null>(null)

  // 明細リスト
  const [details, setDetails] = useState<EstimateDetail[]>(() => {
    if (!copySource?.details?.length) return []
    return copySource.details.map((d, i) => ({
      clientDetailId:   crypto.randomUUID(),
      rowNo:            i + 1,
      materialCode:     d.materialCode,
      materialName:     d.materialName,
      kakouShiyouCode:  d.kakouShiyouCode,
      kakouShiyou:      d.kakouShiyou,
      kakouShijiCodeT:  d.kakouShijiCodeT,
      kakouShijiCodeA:  d.kakouShijiCodeA,
      kakouShijiCodeB:  d.kakouShijiCodeB,
      kakouT:           d.kakouT,
      kakouA:           d.kakouA,
      kakouB:           d.kakouB,
      sizeT:            String(d.sizeT),
      sizeA:            String(d.sizeA),
      sizeB:            String(d.sizeB),
      kousaTUpper:      d.kousaTUpper != null ? String(d.kousaTUpper) : "",
      kousaTLower:      d.kousaTLower != null ? String(d.kousaTLower) : "",
      kousaAUpper:      d.kousaAUpper != null ? String(d.kousaAUpper) : "",
      kousaALower:      d.kousaALower != null ? String(d.kousaALower) : "",
      kousaBUpper:      d.kousaBUpper != null ? String(d.kousaBUpper) : "",
      kousaBLower:      d.kousaBLower != null ? String(d.kousaBLower) : "",
      mentori4:         d.mentori4 != null ? String(d.mentori4) : "",
      mentori8:         d.mentori8 != null ? String(d.mentori8) : "",
      quantity:         String(d.quantity),
      unitPrice:        d.unitPrice,
      totalPrice:       d.totalPrice,
      shortestDelivery: d.shortestDelivery ?? null,
      deliveryDeadline: d.deliveryDeadline ?? null,
      calculated:       d.unitPrice != null && d.unitPrice > 0,
      intermediate:     null,
    }))
  })

  // Draft 用: EstimateDetail（sizeT=string）→ DetailItem（sizeT=number）変換
  const toDetailItems = (dets: EstimateDetail[]) =>
    dets.map(d => ({
      materialCode:    d.materialCode,
      kakouShiyouCode: d.kakouShiyouCode,
      kakouShijiCodeT: d.kakouShijiCodeT || undefined,
      kakouShijiCodeA: d.kakouShijiCodeA || undefined,
      kakouShijiCodeB: d.kakouShijiCodeB || undefined,
      sizeT:           d.sizeT ? parseFloat(d.sizeT) : 0,
      sizeA:           d.sizeA ? parseFloat(d.sizeA) : 0,
      sizeB:           d.sizeB ? parseFloat(d.sizeB) : 0,
      kousaTUpper:     d.kousaTUpper ? parseFloat(d.kousaTUpper) : null,
      kousaTLower:     d.kousaTLower ? parseFloat(d.kousaTLower) : null,
      kousaAUpper:     d.kousaAUpper ? parseFloat(d.kousaAUpper) : null,
      kousaALower:     d.kousaALower ? parseFloat(d.kousaALower) : null,
      kousaBUpper:     d.kousaBUpper ? parseFloat(d.kousaBUpper) : null,
      kousaBLower:     d.kousaBLower ? parseFloat(d.kousaBLower) : null,
      mentori4:        d.mentori4 ? parseFloat(d.mentori4) : null,
      mentori8:        d.mentori8 ? parseFloat(d.mentori8) : null,
      quantity:        d.quantity ? parseInt(d.quantity) : 0,
      unitPrice:       d.unitPrice,
      totalPrice:      d.totalPrice,
      shortestDelivery: d.shortestDelivery ?? null,
      deliveryDeadline: d.deliveryDeadline ?? null,
    }))

  // ヘッダー変更時に自動保存トリガー
  const handleHeaderChange = useCallback((updater: (h: HeaderForm) => HeaderForm) => {
    setHeader(prev => {
      const next = updater(prev)
      triggerSave(next, toDetailItems(details))
      return next
    })
  }, [details, triggerSave]) // eslint-disable-line react-hooks/exhaustive-deps

  // UI状態
  const [calcLoading, setCalcLoading]   = useState(false)
  const [saveLoading, setSaveLoading]   = useState(false)
  const [calcError, setCalcError]       = useState("")
  const [saveMessage, setSaveMessage]   = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [savedEstimateId, setSavedEstimateId] = useState<string | null>(null)

  // ────────────────────────────────────────────────
  // 標準公差・面取の取得
  // ────────────────────────────────────────────────
  const fetchStandardTolerance = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/tolerance/standard?customerCode=${userInfo.customerCode}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.success) {
        // ▼ 変更: APIレスポンスフィールド名修正 TUpper→tUpper, AUpper→aUpper, BUpper→bUpper 等
        setDetailForm(prev => ({
          ...prev,
          kousaTUpper: String(data.tolerance.tUpper ?? ""),
          kousaTLower: String(data.tolerance.tLower ?? ""),
          kousaAUpper: String(data.tolerance.aUpper ?? ""),
          kousaALower: String(data.tolerance.aLower ?? ""),
          kousaBUpper: String(data.tolerance.bUpper ?? ""),
          kousaBLower: String(data.tolerance.bLower ?? ""),
        }))
      }
    } catch { /* silent */ }
  }, [userInfo.customerCode])

  const fetchStandardChamfer = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/chamfer/standard?customerCode=${userInfo.customerCode}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.success) {
        // ▼ 変更: APIレスポンスフィールド名修正 Chamfer4→chamfer4, Chamfer8→chamfer8
        setDetailForm(prev => ({
          ...prev,
          mentori4: String(data.chamfer.chamfer4 ?? ""),
          mentori8: String(data.chamfer.chamfer8 ?? ""),
        }))
      }
    } catch { /* silent */ }
  }, [userInfo.customerCode])

  // ────────────────────────────────────────────────
  // 見積計算
  // ────────────────────────────────────────────────
  const handleCalculate = async () => {
    console.log('[計算] detailForm:', JSON.stringify(detailForm))
    console.log('[計算] cuttingMethods:', JSON.stringify(cuttingMethods))
    setCalcError("")
    setCalcResult(null)

    // バリデーション
    if (!detailForm.materialCode)    { setCalcError("材料を選択してください"); return }
    if (!detailForm.kakouShiyouCode) { setCalcError("加工仕様を選択してください"); return }
    if (!detailForm.sizeT || !detailForm.sizeA || !detailForm.sizeB) {
      setCalcError("仕上りサイズ T・A・B を入力してください"); return
    }
    if (!detailForm.quantity || parseInt(detailForm.quantity) < 1) {
      setCalcError("数量を1以上で入力してください"); return
    }

    setCalcLoading(true)
    try {
      const material = materials.find(m => m.materialCode === detailForm.materialCode)
      const spec     = processingSpecs.find(s => s.processingSpecCode === detailForm.kakouShiyouCode)

      const payload = {
        customerCode:    userInfo.customerCode,
        materialCode:    detailForm.materialCode,
        materialName:    material?.materialName ?? "",
        kakouShiyouCode: detailForm.kakouShiyouCode,
        kakouShiyou:     spec?.processingSpecName ?? "",
        kakouShijiCodeT: detailForm.kakouShijiCodeT,
        kakouShijiCodeA: detailForm.kakouShijiCodeA,
        kakouShijiCodeB: detailForm.kakouShijiCodeB,
        kakouT: cuttingMethods.find(m => String(m.code) === detailForm.kakouShijiCodeT)?.label ?? "",
        kakouA: cuttingMethods.find(m => String(m.code) === detailForm.kakouShijiCodeA)?.label ?? "",
        kakouB: cuttingMethods.find(m => String(m.code) === detailForm.kakouShijiCodeB)?.label ?? "",
        sizeT: parseFloat(detailForm.sizeT),
        sizeA: parseFloat(detailForm.sizeA),
        sizeB: parseFloat(detailForm.sizeB),
        kousaTUpper: parseFloat(detailForm.kousaTUpper) || 0,
        kousaTLower: parseFloat(detailForm.kousaTLower) || 0,
        kousaAUpper: parseFloat(detailForm.kousaAUpper) || 0,
        kousaALower: parseFloat(detailForm.kousaALower) || 0,
        kousaBUpper: parseFloat(detailForm.kousaBUpper) || 0,
        kousaBLower: parseFloat(detailForm.kousaBLower) || 0,
        mentori4: parseFloat(detailForm.mentori4) || 0,
        mentori8: parseFloat(detailForm.mentori8) || 0,
        quantity: parseInt(detailForm.quantity),
        requestNouki: header.requestNouki,
        editMode: "New",
      }

      console.log("[フロント] 計算リクエスト payload:", JSON.stringify(payload, null, 2))
      const res = await fetch("/api/v1/estimates/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        setCalcError(err.error ?? "計算に失敗しました")
        return
      }

      const result = await res.json()
      console.log("[フロント] 計算レスポンス:", JSON.stringify(result, null, 2))
      // ▼ 変更: APIレスポンス { unitPrice, sumPrice, shortestDelivery, deliveryDeadline, intermediate }
      //         sumPrice → totalPrice としてstateに格納、intermediate を保持
      setCalcResult({
        unitPrice:        result.unitPrice,
        totalPrice:       result.sumPrice,
        shortestDelivery: result.shortestDelivery,
        deliveryDeadline: result.deliveryDeadline,
        intermediate:     result.intermediate ?? null,
      })
    } catch {
      setCalcError("通信エラーが発生しました")
    } finally {
      setCalcLoading(false)
    }
  }

  // ────────────────────────────────────────────────
  // 明細追加
  // ────────────────────────────────────────────────
  const canAddDetail = !!(
    detailForm.materialCode &&
    detailForm.kakouShiyouCode &&
    detailForm.sizeT && detailForm.sizeA && detailForm.sizeB &&
    detailForm.quantity &&
    calcResult
  )

  const handleAddDetail = () => {
    console.log('[明細追加] canAddDetail:', canAddDetail, 'calcResult:', JSON.stringify(calcResult))
    if (!canAddDetail || !calcResult) return
    const material = materials.find(m => m.materialCode === detailForm.materialCode)
    const spec     = processingSpecs.find(s => s.processingSpecCode === detailForm.kakouShiyouCode)

    const newDetail: EstimateDetail = {
      clientDetailId:  crypto.randomUUID(),
      rowNo:           details.length + 1,
      materialCode:    detailForm.materialCode,
      materialName:    material?.materialName ?? "",
      kakouShiyouCode: detailForm.kakouShiyouCode,
      kakouShiyou:     spec?.processingSpecName ?? "",
      kakouShijiCodeT: detailForm.kakouShijiCodeT,
      kakouShijiCodeA: detailForm.kakouShijiCodeA,
      kakouShijiCodeB: detailForm.kakouShijiCodeB,
      kakouT: cuttingMethods.find(m => String(m.code) === detailForm.kakouShijiCodeT)?.label ?? "",
      kakouA: cuttingMethods.find(m => String(m.code) === detailForm.kakouShijiCodeA)?.label ?? "",
      kakouB: cuttingMethods.find(m => String(m.code) === detailForm.kakouShijiCodeB)?.label ?? "",
      sizeT: detailForm.sizeT,
      sizeA: detailForm.sizeA,
      sizeB: detailForm.sizeB,
      kousaTUpper: detailForm.kousaTUpper, kousaTLower: detailForm.kousaTLower,
      kousaAUpper: detailForm.kousaAUpper, kousaALower: detailForm.kousaALower,
      kousaBUpper: detailForm.kousaBUpper, kousaBLower: detailForm.kousaBLower,
      mentori4:    detailForm.mentori4,
      mentori8:    detailForm.mentori8,
      quantity:    detailForm.quantity,
      unitPrice:        calcResult.unitPrice,
      totalPrice:       calcResult.totalPrice,
      shortestDelivery: calcResult.shortestDelivery,
      deliveryDeadline: calcResult.deliveryDeadline,
      calculated:       true,
      // ▼ 追加: 計算中間値を明細に保持
      intermediate:     calcResult.intermediate,
    }

    setDetails(prev => {
      const next = [...prev, newDetail]
      triggerSave(header, toDetailItems(next), true) // 明細追加時は即時保存
      return next
    })
    setDetailForm(EMPTY_DETAIL_FORM)
    setCalcResult(null)
    setCalcError("")
  }

  // ────────────────────────────────────────────────
  // 明細削除
  // ────────────────────────────────────────────────
  const handleDeleteDetail = (clientDetailId: string) => {
    setDetails(prev =>
      prev
        .filter(d => d.clientDetailId !== clientDetailId)
        .map((d, i) => ({ ...d, rowNo: i + 1 }))
    )
  }

  // ── 明細行 編集（Task 2-5）──
  const handleEditDetail = (clientDetailId: string) => {
    const target = details.find(d => d.clientDetailId === clientDetailId)
    if (!target) return
    // フォームに値をセット
    setDetailForm({
      materialCode:    target.materialCode,
      kakouShiyouCode: target.kakouShiyouCode,
      kakouShijiCodeT: target.kakouShijiCodeT,
      kakouShijiCodeA: target.kakouShijiCodeA,
      kakouShijiCodeB: target.kakouShijiCodeB,
      sizeT: target.sizeT, sizeA: target.sizeA, sizeB: target.sizeB,
      kousaTUpper: target.kousaTUpper, kousaTLower: target.kousaTLower,
      kousaAUpper: target.kousaAUpper, kousaALower: target.kousaALower,
      kousaBUpper: target.kousaBUpper, kousaBLower: target.kousaBLower,
      mentori4: target.mentori4, mentori8: target.mentori8,
      quantity: target.quantity,
    })
    // 対象行を一覧から削除（再計算→追加の流れ）
    setDetails(prev => prev.filter(d => d.clientDetailId !== clientDetailId).map((d, i) => ({ ...d, rowNo: i + 1 })))
    setCalcResult(null)
    setCalcError("")
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ────────────────────────────────────────────────
  // 合計金額
  // ────────────────────────────────────────────────
  const grandTotal = details.reduce((s, d) => s + (d.totalPrice ?? 0), 0)

  // ────────────────────────────────────────────────
  // 保存
  // ────────────────────────────────────────────────
  const handleSave = async () => {
    console.log('[保存] header:', JSON.stringify(header))
    console.log('[保存] details:', JSON.stringify(details))
    setSaveMessage(null)
    if (!header.inputDate)    { setSaveMessage({ type: "error", text: "入力日付は必須です" }); return }
    if (details.length === 0) { setSaveMessage({ type: "error", text: "明細を1件以上追加してください" }); return }

    setSaveLoading(true)
    try {
      // ▼ 変更: route.ts の SaveHeaderRequest 形式に合わせたペイロード構造
      //         + intermediate を各明細に含める
      const payload = {
        inputDate:         header.inputDate,
        customerOrderNo:   header.customerOrderNo || undefined,
        endUserNo:         header.endUserNo || undefined,
        destinationCode:   header.destinationCode || undefined,
        destinationName:   header.destinationName || undefined,
        destinationDept:   header.destinationDept || undefined,
        destinationPerson:  header.destinationPerson || undefined,
        destinationZip:     header.destinationZip || undefined,
        destinationAddress: header.destinationAddress || undefined,
        destinationTel:     header.destinationTel || undefined,
        destinationFax:     header.destinationFax || undefined,
        estimateDate:      header.estimateDate || header.inputDate,
        requestNouki:      header.requestNouki || undefined,
        chargeName:        header.chargeName || undefined,
        remarks:           header.remarks || undefined,
        editMode:          "New" as const,
        details: details.map((d, idx) => ({
          clientDetailId:      d.clientDetailId,
          rowNo:               idx + 1,
          materialCode:        d.materialCode,
          materialName:        d.materialName,
          kakouShiyouCode:     d.kakouShiyouCode,
          kakouShiyou:         d.kakouShiyou,
          kakouShijiCodeT:     d.kakouShijiCodeT || undefined,
          kakouShijiCodeA:     d.kakouShijiCodeA || undefined,
          kakouShijiCodeB:     d.kakouShijiCodeB || undefined,
          kakouT:              d.kakouT,
          kakouA:              d.kakouA,
          kakouB:              d.kakouB,
          sizeT:               parseFloat(d.sizeT),
          sizeA:               parseFloat(d.sizeA),
          sizeB:               parseFloat(d.sizeB),
          kousaTUpper: d.kousaTUpper ? parseFloat(d.kousaTUpper) : null,
          kousaTLower: d.kousaTLower ? parseFloat(d.kousaTLower) : null,
          kousaAUpper: d.kousaAUpper ? parseFloat(d.kousaAUpper) : null,
          kousaALower: d.kousaALower ? parseFloat(d.kousaALower) : null,
          kousaBUpper: d.kousaBUpper ? parseFloat(d.kousaBUpper) : null,
          kousaBLower: d.kousaBLower ? parseFloat(d.kousaBLower) : null,
          mentori4:    d.mentori4 ? parseFloat(d.mentori4) : null,
          mentori8:    d.mentori8 ? parseFloat(d.mentori8) : null,
          quantity:            parseInt(d.quantity),
          unitPrice:           d.unitPrice!,
          totalPrice:          d.totalPrice!,
          shortestDelivery:    d.shortestDelivery ?? undefined,
          deliveryDeadline:    d.deliveryDeadline ?? null,
          // ▼ 追加: 計算中間値
          materialSizeT:       d.intermediate?.materialSizeT,
          materialSizeA:       d.intermediate?.materialSizeA,
          materialSizeB:       d.intermediate?.materialSizeB,
          materialUnitWeight:  d.intermediate?.materialUnitWeight,
          materialTotalWeight: d.intermediate?.materialTotalWeight,
          productUnitWeight:   d.intermediate?.productUnitWeight,
          productTotalWeight:  d.intermediate?.productTotalWeight,
          processingCost6f:    d.intermediate?.processingCost6f,
          processingCostTotal: d.intermediate?.processingCostTotal,
        })),
      }

      const res = await fetch("/api/v1/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        setSaveMessage({ type: "error", text: err.error ?? "保存に失敗しました" })
        return
      }

      const saved = await res.json()
      console.log('[保存API] レスポンス:', JSON.stringify(saved))
      setSaveMessage({ type: "success", text: `✅ 見積を保存しました　見積No: ${saved.estimateNo ?? saved.estimateId?.slice(0,8)}` })
      setSavedEstimateId(saved.estimateId)
      // 保存後は編集画面へ遷移せず、注文ボタンを表示する
    } catch {
      setSaveMessage({ type: "error", text: "通信エラーが発生しました" })
    } finally {
      setSaveLoading(false)
    }
  }

  // ────────────────────────────────────────────────
  // render
  // ────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* メッセージエリア */}
      {saveMessage && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
          saveMessage.type === "success"
            ? "bg-green-50 border border-green-200 text-green-800"
            : "bg-red-50 border border-red-200 text-red-700"
        }`}>
          {saveMessage.type === "success" ? "✅ " : "✕ "}
          {saveMessage.text}
        </div>
      )}

      {/* 直送先検索モーダル */}
      {showDDModal && (
        <DirectDeliveryModal
          customerCode={userInfo.customerCode}
          onSelect={(dd) => {
            console.log("[直送先選択] 自動入力:", dd)
            setHeader(h => ({
              ...h,
              destinationCode:    dd.deliveryCode,
              destinationName:    dd.name,
              destinationDept:    dd.departmentName,
              destinationPerson:  dd.chargeName,
              destinationZip:     dd.postalCode,
              destinationAddress: [dd.address1, dd.address2, dd.address3].filter(Boolean).join(""),
              destinationTel:     dd.tel,
              destinationFax:     dd.fax,
            }))
          }}
          onClose={() => setShowDDModal(false)}
        />
      )}

      {/* ──────── ヘッダー情報 ──────── */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <p className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wide">
          ヘッダー情報
        </p>

        {/* 得意先情報（読取専用） */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="text-[10px] text-gray-400">得意先コード</p>
            <p className="text-sm font-medium text-gray-700">{userInfo.customerCode}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-[10px] text-gray-400">得意先名</p>
            <p className="text-sm font-medium text-gray-700">{userInfo.customerName}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400">担当者名</p>
            <p className="text-sm font-medium text-gray-700">{userInfo.chargeName}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* 入力日付 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              入力日付 <span className="text-red-500">★</span>
            </label>
            <input
              type="date"
              value={header.inputDate}
              onChange={e => { console.log("[入力日付]", e.target.value); setHeader(h => ({ ...h, inputDate: e.target.value })) }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ochi-input"
            />
          </div>

          {/* 見積日付 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              見積日付 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={header.estimateDate}
              onChange={e => setHeader(h => ({ ...h, estimateDate: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-yellow-50"
            />
          </div>

          {/* 希望納期 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">希望納期</label>
            <input
              type="text"
              value={header.requestNouki}
              onChange={e => setHeader(h => ({ ...h, requestNouki: e.target.value }))}
              placeholder="例: 2026-06-30"
              maxLength={20}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-yellow-50"
            />
          </div>

          {/* 担当者名 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">担当者名</label>
            <input
              type="text"
              value={header.chargeName}
              onChange={e => setHeader(h => ({ ...h, chargeName: e.target.value }))}
              maxLength={50}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-yellow-50"
            />
          </div>

          {/* お客様注文番号 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              お客様注文番号
            </label>
            <input
              type="text"
              value={header.customerOrderNo}
              onChange={e => { console.log("[お客様注文番号]", e.target.value); setHeader(h => ({ ...h, customerOrderNo: e.target.value })) }}
              maxLength={50}
              placeholder="例: ORD-2026-001"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ochi-input"
            />
          </div>

          {/* エンドユーザー番号 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              エンドユーザー番号
            </label>
            <input
              type="text"
              value={header.endUserNo}
              onChange={e => { console.log("[エンドユーザー番号]", e.target.value); setHeader(h => ({ ...h, endUserNo: e.target.value })) }}
              maxLength={50}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ochi-input"
            />
          </div>

        </div>

        {/* 送り先情報 */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">── 送り先情報</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">送り先コード</label>
              <input
                type="text"
                value={header.destinationCode}
                onChange={e => { console.log("[送り先コード]", e.target.value); setHeader(h => ({ ...h, destinationCode: e.target.value })) }}
                maxLength={20}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ochi-input"
              />
            </div>

            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-600">送り先名称</label>
                <button
                  type="button"
                  onClick={() => { console.log("[直送先検索ボタン(New)] クリック"); setShowDDModal(true) }}
                  className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1"
                >
                  🔍 直送先検索
                </button>
              </div>
              <input
                type="text"
                value={header.destinationName}
                onChange={e => { console.log("[送り先名]", e.target.value); setHeader(h => ({ ...h, destinationName: e.target.value })) }}
                maxLength={100}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ochi-input"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">部署名</label>
              <input
                type="text"
                value={header.destinationDept}
                onChange={e => { console.log("[部署名]", e.target.value); setHeader(h => ({ ...h, destinationDept: e.target.value })) }}
                maxLength={50}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ochi-input"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">担当者名</label>
              <input
                type="text"
                value={header.destinationPerson}
                onChange={e => { console.log("[担当者名]", e.target.value); setHeader(h => ({ ...h, destinationPerson: e.target.value })) }}
                maxLength={50}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ochi-input"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">郵便番号</label>
              <input
                type="text"
                value={header.destinationZip}
                onChange={e => { console.log("[郵便番号]", e.target.value); setHeader(h => ({ ...h, destinationZip: e.target.value })) }}
                maxLength={8}
                placeholder="000-0000"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ochi-input"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">住所</label>
              <input
                type="text"
                value={header.destinationAddress}
                onChange={e => { console.log("[住所]", e.target.value); setHeader(h => ({ ...h, destinationAddress: e.target.value })) }}
                maxLength={200}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ochi-input"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">TEL</label>
              <input
                type="text"
                value={header.destinationTel}
                onChange={e => { console.log("[TEL]", e.target.value); setHeader(h => ({ ...h, destinationTel: e.target.value })) }}
                maxLength={20}
                placeholder="00-0000-0000"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ochi-input"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">FAX</label>
              <input
                type="text"
                value={header.destinationFax}
                onChange={e => { console.log("[FAX]", e.target.value); setHeader(h => ({ ...h, destinationFax: e.target.value })) }}
                maxLength={20}
                placeholder="00-0000-0000"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ochi-input"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">希望納期</label>
              <input
                type="date"
                value={header.requestNouki}
                onChange={e => { console.log("[希望納期]", e.target.value); setHeader(h => ({ ...h, requestNouki: e.target.value })) }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ochi-input"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">備考</label>
              <input
                type="text"
                value={header.remarks}
                onChange={e => { console.log("[備考]", e.target.value); setHeader(h => ({ ...h, remarks: e.target.value })) }}
                maxLength={200}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ochi-input"
              />
            </div>

          </div>
        </div>
      </section>

      {/* ──────── 明細入力エリア ──────── */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <p className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wide">
          明細入力
        </p>

        {/* 計算エラー */}
        {calcError && (
          <div className="mb-3 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            ✕ {calcError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* 材料 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              材料 <span className="text-red-500">★</span>
            </label>
            <select
              value={detailForm.materialCode}
              onChange={e => {
                console.log("[材料選択]", e.target.value)
                setDetailForm(p => ({ ...p, materialCode: e.target.value }))
                setCalcResult(null)
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">選択してください</option>
              {materials.map(m => (
                <option key={m.materialCode} value={m.materialCode}>
                  {m.materialCode} — {m.materialName}
                </option>
              ))}
            </select>
          </div>

          {/* 加工仕様 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              加工仕様 <span className="text-red-500">★</span>
            </label>
            <select
              value={detailForm.kakouShiyouCode || ""}
              onChange={e => {
                console.log("[加工仕様選択]", e.target.value)
                setDetailForm(p => ({ ...p, kakouShiyouCode: parseInt(e.target.value) || 0 }))
                setCalcResult(null)
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">選択してください</option>
              {processingSpecs.map(s => (
                <option key={s.processingSpecCode} value={s.processingSpecCode}>
                  {s.processingSpecName}
                </option>
              ))}
            </select>
          </div>

          {/* 加工指示T */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">加工指示（T面）</label>
            <select
              value={detailForm.kakouShijiCodeT}
              onChange={e => { console.log("[加工指示T]", e.target.value); setDetailForm(p => ({ ...p, kakouShijiCodeT: e.target.value })) }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">（なし）</option>
              {cuttingMethods.map(m => (
                <option key={m.code} value={String(m.code)}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* 加工指示A */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">加工指示（A面）</label>
            <select
              value={detailForm.kakouShijiCodeA}
              onChange={e => { console.log("[加工指示A]", e.target.value); setDetailForm(p => ({ ...p, kakouShijiCodeA: e.target.value })) }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">（なし）</option>
              {cuttingMethods.map(m => (
                <option key={m.code} value={String(m.code)}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* 加工指示B */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">加工指示（B面）</label>
            <select
              value={detailForm.kakouShijiCodeB}
              onChange={e => { console.log("[加工指示B]", e.target.value); setDetailForm(p => ({ ...p, kakouShijiCodeB: e.target.value })) }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">（なし）</option>
              {cuttingMethods.map(m => (
                <option key={m.code} value={String(m.code)}>{m.label}</option>
              ))}
            </select>
          </div>

        </div>

        {/* 仕上りサイズ */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-3">── 仕上りサイズ</p>
          <div className="grid grid-cols-3 gap-3">
            {(["T", "A", "B"] as const).map(axis => (
              <div key={axis}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {axis === "T" ? "厚み T" : axis === "A" ? "幅 A" : "長さ B"}
                  {" "}<span className="text-red-500">★</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    max="9999.999"
                    value={detailForm[`size${axis}` as keyof DetailForm]}
                    onChange={e => {
                      console.log(`[寸法${axis}]`, e.target.value)
                      setDetailForm(p => ({ ...p, [`size${axis}`]: e.target.value }))
                      setCalcResult(null)
                    }}
                    onBlur={e => setDetailForm(p => ({ ...p, [`size${axis}`]: formatDimension(e.target.value) }))}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.000"
                  />
                  <span className="text-xs text-gray-400">mm</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 公差 */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400">── 公差</p>
            <button
              type="button"
              onClick={() => { console.log("[標準公差ボタン] クリック"); fetchStandardTolerance() }}
              className="text-xs px-2.5 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors"
            >
              標準公差
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(["T", "A", "B"] as const).map(axis => (
              <div key={axis}>
                <p className="text-[10px] text-gray-500 mb-1">{axis}面</p>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    step="0.001"
                    value={detailForm[`kousa${axis}Upper` as keyof DetailForm]}
                    onChange={e => { console.log(`[公差${axis}上限]`, e.target.value); setDetailForm(p => ({ ...p, [`kousa${axis}Upper`]: e.target.value })) }}
                    placeholder="上限"
                    className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    step="0.001"
                    value={detailForm[`kousa${axis}Lower` as keyof DetailForm]}
                    onChange={e => { console.log(`[公差${axis}下限]`, e.target.value); setDetailForm(p => ({ ...p, [`kousa${axis}Lower`]: e.target.value })) }}
                    placeholder="下限"
                    className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 面取り */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400">── 面取り</p>
            <button
              type="button"
              onClick={() => { console.log("[標準面取ボタン] クリック"); fetchStandardChamfer() }}
              className="text-xs px-2.5 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors"
            >
              標準面取
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">4C 面取り量</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.01"
                  value={detailForm.mentori4}
                  onChange={e => { console.log('[4C面取り]', e.target.value); setDetailForm(p => ({ ...p, mentori4: e.target.value })) }}
                  placeholder="0.00"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400">mm</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">8C 面取り量</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.01"
                  value={detailForm.mentori8}
                  onChange={e => { console.log('[8C面取り]', e.target.value); setDetailForm(p => ({ ...p, mentori8: e.target.value })) }}
                  placeholder="0.00"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400">mm</span>
              </div>
            </div>
          </div>
        </div>

        {/* 数量 */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                数量 <span className="text-red-500">★</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={detailForm.quantity}
                onChange={e => {
                  console.log('[数量]', e.target.value)
                  console.log('[数量]', e.target.value)
                  setDetailForm(p => ({ ...p, quantity: e.target.value }))
                  setCalcResult(null)
                }}
                placeholder="1"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ochi-input"
              />
            </div>

            {/* 計算結果表示 */}
            {calcResult && (
              <div className="sm:col-span-3 p-3 rounded-lg bg-blue-50 border border-blue-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <p className="text-blue-400">見積単価</p>
                  <p className="font-bold text-blue-800">¥{calcResult.unitPrice.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-blue-400">見積金額</p>
                  <p className="font-bold text-blue-800">¥{calcResult.totalPrice.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-blue-400">最短納期</p>
                  <p className="font-bold text-blue-800">{calcResult.shortestDelivery}</p>
                </div>
                <div>
                  <p className="text-blue-400">有効期限</p>
                  <p className="font-bold text-blue-800">
                    {calcResult.deliveryDeadline
                      ? new Date(calcResult.deliveryDeadline).toLocaleDateString("ja-JP")
                      : "—"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ボタン行 */}
        <div className="mt-4 flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={() => {
              console.log("[入力クリアボタン] クリック")
              setDetailForm(EMPTY_DETAIL_FORM)
              setCalcResult(null)
              setCalcError("")
            }}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            入力クリア
          </button>
          <button
            type="button"
            onClick={() => { console.log("[見積計算ボタン] クリック"); handleCalculate() }}
            disabled={calcLoading}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {calcLoading ? "計算中..." : "📊 見積計算"}
          </button>
          <button
            type="button"
            onClick={() => { console.log("[明細追加ボタン] クリック"); handleAddDetail() }}
            disabled={!canAddDetail}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ＋ 明細に追加
          </button>
        </div>
      </section>

      {/* ──────── 明細テーブル ──────── */}
      {details.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              見積明細
            </p>
            <p className="text-sm font-bold text-gray-700">
              合計：<span className="text-lg text-blue-700">¥{grandTotal.toLocaleString()}</span>
              <span className="text-xs text-gray-400 ml-1">（税抜）</span>
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-gray-500 whitespace-nowrap">No</th>
                  <th className="px-3 py-2 text-left text-gray-500 whitespace-nowrap">材料 <span className="text-red-500">*</span></th>
                  <th className="px-3 py-2 text-left text-gray-500 whitespace-nowrap">加工仕様 <span className="text-red-500">*</span></th>
                  <th className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">T</th>
                  <th className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">A</th>
                  <th className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">B</th>
                  <th className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">公差T</th>
                  <th className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">公差A</th>
                  <th className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">公差B</th>
                  <th className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">4C</th>
                  <th className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">8C</th>
                  <th className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">数量 <span className="text-red-500">*</span></th>
                  <th className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">単価</th>
                  <th className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">金額</th>
                  <th className="px-3 py-2 text-center text-gray-500 whitespace-nowrap">最短納期</th>
                  <th className="px-3 py-2 text-center text-gray-500 whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {details.map((d, i) => (
                  <tr key={d.clientDetailId} className={i % 2 === 1 ? "bg-gray-50/50" : ""}>
                    <td className="px-3 py-2.5 text-gray-500">{d.rowNo}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-700 whitespace-nowrap">
                      {d.materialName}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{d.kakouShiyou}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{d.sizeT}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{d.sizeA}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{d.sizeB}</td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-[10px]">
                      {d.kousaTUpper || d.kousaTLower ? `+${d.kousaTUpper||0}/-${d.kousaTLower||0}` : "–"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-[10px]">
                      {d.kousaAUpper || d.kousaALower ? `+${d.kousaAUpper||0}/-${d.kousaALower||0}` : "–"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-[10px]">
                      {d.kousaBUpper || d.kousaBLower ? `+${d.kousaBUpper||0}/-${d.kousaBLower||0}` : "–"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-[10px]">{d.mentori4 || "–"}</td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-[10px]">{d.mentori8 || "–"}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{d.quantity}</td>
                    <td className="px-3 py-2.5 text-right text-gray-700">
                      {d.unitPrice != null ? `¥${d.unitPrice.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-800">
                      {d.totalPrice != null ? `¥${d.totalPrice.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center text-gray-600 whitespace-nowrap">
                      {d.shortestDelivery ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => { console.log("[削除ボタン] clientDetailId:", d.clientDetailId); handleDeleteDetail(d.clientDetailId) }}
                        className="px-2 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Draft 自動保存インジケーター */}
          <div className="px-5 pt-3 flex justify-end">
            <DraftSaveIndicator
              status={saveStatus}
              savedAt={savedAt}
              onRetry={() => triggerSave(header, toDetailItems(details), true)}
            />
          </div>

      {/* 保存・注文ボタン */}
          <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3 flex-wrap">
            {savedEstimateId && (
              <a
                href={`/orders/confirm?estimateId=${savedEstimateId}`}
                className="px-5 py-2.5 text-sm rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                🛒 注文する
              </a>
            )}
            <button
              type="button"
              onClick={() => { console.log("[保存ボタン] クリック"); handleSave() }}
              disabled={saveLoading}
              className="px-6 py-2.5 text-sm font-medium rounded-lg bg-[#1a2744] text-white hover:bg-[#1a3a6e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saveLoading ? "保存中..." : "💾 保存"}
            </button>
          </div>
        </section>
      )}

    </div>
  )
}