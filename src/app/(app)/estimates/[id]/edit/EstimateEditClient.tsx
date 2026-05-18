// src/app/(app)/estimates/[id]/edit/EstimateEditClient.tsx
// STEP 14: 見積編集クライアントコンポーネント
// 既存の EstimateNewClient をベースに EditMode=Edit で動作

"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"

// ──────────────────────────────────────────────────────
// 型定義（EstimateNewClientと同じ構造）
// ──────────────────────────────────────────────────────

type Material       = { materialCode: string; materialName: string }
type ProcessingSpec = { processingSpecCode: number; processingSpecName: string }

// 加工指示の選択肢
type CuttingMethod = { code: number; label: string }

type EstimateDetail = {
  clientDetailId:  string
  rowNo:           number
  materialCode:    string
  materialName:    string
  kakouShiyouCode: number
  kakouShiyou:     string
  kakouShijiCodeT: string
  kakouShijiCodeA: string
  kakouShijiCodeB: string
  kakouT:          string
  kakouA:          string
  kakouB:          string
  sizeT:           string
  sizeA:           string
  sizeB:           string
  kousaTUpper:     string
  kousaTLower:     string
  kousaAUpper:     string
  kousaALower:     string
  kousaBUpper:     string
  kousaBLower:     string
  mentori4:        string
  mentori8:        string
  quantity:        string
  unitPrice:       number | null
  totalPrice:      number | null
  shortestDelivery: string
  deliveryDeadline: string | null
  calculated:      boolean
  intermediate?:   Record<string, number>
}

type HeaderForm = {
  inputDate:         string
  customerOrderNo:   string
  endUserNo:         string
  destinationCode:   string
  destinationName:   string
  destinationDept:   string
  destinationPerson: string
  destinationZip:    string
  destinationAddress: string
  destinationTel:    string
  destinationFax:    string
  requestNouki:      string
  remarks:           string
}

// 直送先検索結果型
type DirectDelivery = {
  code:       string
  name:       string
  department: string
  person:     string
  zipCode:    string
  address:    string
  tel:        string
  fax:        string
}


type DetailForm = Omit<EstimateDetail,
  | "clientDetailId"
  | "rowNo"
  | "materialName"
  | "kakouShiyou"
  | "kakouT"
  | "kakouA"
  | "kakouB"
  | "unitPrice"
  | "totalPrice"
  | "shortestDelivery"
  | "deliveryDeadline"
  | "calculated"
  | "intermediate"
>

const EMPTY_DETAIL_FORM: DetailForm = {
  materialCode:    "",
  kakouShiyouCode: 0,
  kakouShijiCodeT: "", kakouShijiCodeA: "", kakouShijiCodeB: "",
  sizeT: "", sizeA: "", sizeB: "",
  kousaTUpper: "", kousaTLower: "",
  kousaAUpper: "", kousaALower: "",
  kousaBUpper: "", kousaBLower: "",
  mentori4: "", mentori8: "",
  quantity: "",
}

interface EstimateData {
  id:               string
  estimateNo:       string
  estimateStatus:   string
  inputDate:        string
  customerOrderNo:  string
  endUserNo:        string
  destinationCode:  string
  destinationName:  string
  destinationDept:  string
  destinationPerson: string
  destinationZip:   string
  destinationAddress: string
  destinationTel:   string
  destinationFax:   string
  remarks:          string
  details: {
    id:              string
    rowNo:           number
    materialCode:    string
    materialName:    string
    kakouShiyouCode: number
    kakouShiyou:     string
    kakouShijiCodeT: string
    kakouShijiCodeA: string
    kakouShijiCodeB: string
    kakouT:          string
    kakouA:          string
    kakouB:          string
    sizeT:           number
    sizeA:           number
    sizeB:           number
    kousaTUpper:     number | null
    kousaTLower:     number | null
    kousaAUpper:     number | null
    kousaALower:     number | null
    kousaBUpper:     number | null
    kousaBLower:     number | null
    mentori4:        number | null
    mentori8:        number | null
    quantity:        number
    unitPrice:       number | null
    totalPrice:      number | null
    shortestDelivery: string
    deliveryDeadline: string | null
  }[]
}

interface Props {
  estimateData:   EstimateData
  materials:      Material[]
  processingSpecs: ProcessingSpec[]
  userInfo: {
    customerCode: string
    customerName: string
    chargeName:   string
    userId:       string
  }
}

// ──────────────────────────────────────────────────────
// DBデータ → クライアント型に変換
// ──────────────────────────────────────────────────────
function dbDetailToClientDetail(d: EstimateData["details"][number]): EstimateDetail {
  return {
    clientDetailId:  d.id,
    rowNo:           d.rowNo,
    materialCode:    d.materialCode,
    materialName:    d.materialName,
    kakouShiyouCode: d.kakouShiyouCode,
    kakouShiyou:     d.kakouShiyou,
    kakouShijiCodeT: d.kakouShijiCodeT,
    kakouShijiCodeA: d.kakouShijiCodeA,
    kakouShijiCodeB: d.kakouShijiCodeB,
    kakouT:          d.kakouT,
    kakouA:          d.kakouA,
    kakouB:          d.kakouB,
    sizeT:           String(d.sizeT),
    sizeA:           String(d.sizeA),
    sizeB:           String(d.sizeB),
    kousaTUpper:     d.kousaTUpper != null ? String(d.kousaTUpper) : "",
    kousaTLower:     d.kousaTLower != null ? String(d.kousaTLower) : "",
    kousaAUpper:     d.kousaAUpper != null ? String(d.kousaAUpper) : "",
    kousaALower:     d.kousaALower != null ? String(d.kousaALower) : "",
    kousaBUpper:     d.kousaBUpper != null ? String(d.kousaBUpper) : "",
    kousaBLower:     d.kousaBLower != null ? String(d.kousaBLower) : "",
    mentori4:        d.mentori4 != null ? String(d.mentori4) : "",
    mentori8:        d.mentori8 != null ? String(d.mentori8) : "",
    quantity:        String(d.quantity),
    unitPrice:       d.unitPrice,
    totalPrice:      d.totalPrice,
    shortestDelivery: d.shortestDelivery,
    deliveryDeadline: d.deliveryDeadline,
    calculated:      d.unitPrice != null && d.unitPrice > 0,
  }
}

// ──────────────────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────────────────

export default function EstimateEditClient({ estimateData, materials, processingSpecs, userInfo }: Props) {
  const router = useRouter()

  // ── 状態 ──
  // ── 納期有効期限チェック（編集モード時） ──
  useEffect(() => {
    if (!estimateId) return
    const checkDeadline = async () => {
      try {
        const res = await fetch(`/api/v1/estimates/${estimateId}/check-deadline`, { method: "POST" })
        if (!res.ok) return
        const data = await res.json()
        if (data.hasExpired) {
          const rows = (data.expiredDetails as Array<{rowNo:number}>).map((d:any) => `No.${d.rowNo}`).join("、")
          alert(`⚠️ 納期保証期限が切れた明細があります（${rows}）。\n内容をご確認の上、見積計算を再実行してから保存してください。`)
        }
      } catch { /* silent */ }
    }
    checkDeadline()
  }, [estimateId])

  const [header, setHeader] = useState<HeaderForm>({
    inputDate:         estimateData.inputDate,
    customerOrderNo:   estimateData.customerOrderNo,
    endUserNo:         estimateData.endUserNo,
    destinationCode:   estimateData.destinationCode,
    destinationName:   estimateData.destinationName,
    destinationDept:   estimateData.destinationDept,
    destinationPerson: estimateData.destinationPerson,
    destinationZip:    estimateData.destinationZip,
    destinationAddress: estimateData.destinationAddress,
    destinationTel:    estimateData.destinationTel,
    destinationFax:    estimateData.destinationFax,
    requestNouki:      "",
    remarks:           estimateData.remarks,
  })

  // 直送先検索モーダル
  const [showDDModal,  setShowDDModal]  = useState(false)
  const [ddSearch,     setDdSearch]     = useState({ name: "", address: "", code: "", tel: "" })
  const [ddResults,    setDdResults]    = useState<DirectDelivery[]>([])
  const [ddLoading,    setDdLoading]    = useState(false)
  const [ddError,      setDdError]      = useState("")

  const [details, setDetails] = useState<EstimateDetail[]>(
    estimateData.details.map(dbDetailToClientDetail)
  )

  // ── 明細追加用 state ──
  const [cuttingMethods, setCuttingMethods] = useState<CuttingMethod[]>([])

  const [detailForm, setDetailForm] = useState<DetailForm>(EMPTY_DETAIL_FORM)

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

  const [calcLoading, setCalcLoading] = useState(false)
  const [calcError,   setCalcError]   = useState("")

  const [saveLoading, setSaveLoading] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)


  // ── 加工指示マスタ取得 ──
  useEffect(() => {
    console.log('[Edit] 加工指示API fetch start, customerCode:', userInfo.customerCode)
    fetch(`/api/v1/cutting-methods?customerCode=${userInfo.customerCode}`)
      .then(r => r.json())
      .then(data => {
        console.log('[Edit][加工指示API] レスポンス:', data)
        if (data.methods) setCuttingMethods(data.methods)
      })
      .catch(e => { console.error('[Edit][加工指示API] エラー:', e) })
  }, [userInfo.customerCode])

  // ── 標準公差・面取取得 ──
  const fetchStandardTolerance = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/tolerance/standard?customerCode=${userInfo.customerCode}`)
      if (!res.ok) return
      const data = await res.json()
      console.log('[Edit][標準公差] レスポンス:', data)
      if (data.success) {
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
      console.log('[Edit][標準面取] レスポンス:', data)
      if (data.success) {
        setDetailForm(prev => ({
          ...prev,
          mentori4: String(data.chamfer.chamfer4 ?? ""),
          mentori8: String(data.chamfer.chamfer8 ?? ""),
        }))
      }
    } catch { /* silent */ }
  }, [userInfo.customerCode])

  // ── 見積計算 ──
  const handleCalculate = async () => {
    console.log('[Edit][計算] detailForm:', JSON.stringify(detailForm))
    setCalcError("")
    setCalcResult(null)
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
        editMode: "Edit",
      }
      console.log('[Edit][フロント] 計算リクエスト payload:', JSON.stringify(payload, null, 2))
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
      console.log('[Edit][フロント] 計算レスポンス:', JSON.stringify(result, null, 2))
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

  // ── 明細追加 ──
  const canAddDetail = !!(
    detailForm.materialCode &&
    detailForm.kakouShiyouCode &&
    detailForm.sizeT && detailForm.sizeA && detailForm.sizeB &&
    detailForm.quantity &&
    calcResult
  )

  const handleAddDetail = () => {
    console.log('[Edit][明細追加] canAddDetail:', canAddDetail, 'calcResult:', JSON.stringify(calcResult))
    if (!canAddDetail || !calcResult) return
    const material = materials.find(m => m.materialCode === detailForm.materialCode)
    const spec     = processingSpecs.find(s => s.processingSpecCode === detailForm.kakouShiyouCode)
    const newDetail: EstimateDetail = {
      clientDetailId:   crypto.randomUUID(),
      rowNo:            details.length + 1,
      materialCode:     detailForm.materialCode,
      materialName:     material?.materialName ?? "",
      kakouShiyouCode:  detailForm.kakouShiyouCode,
      kakouShiyou:      spec?.processingSpecName ?? "",
      kakouShijiCodeT:  detailForm.kakouShijiCodeT,
      kakouShijiCodeA:  detailForm.kakouShijiCodeA,
      kakouShijiCodeB:  detailForm.kakouShijiCodeB,
      kakouT: cuttingMethods.find(m => String(m.code) === detailForm.kakouShijiCodeT)?.label ?? "",
      kakouA: cuttingMethods.find(m => String(m.code) === detailForm.kakouShijiCodeA)?.label ?? "",
      kakouB: cuttingMethods.find(m => String(m.code) === detailForm.kakouShijiCodeB)?.label ?? "",
      sizeT:            detailForm.sizeT,
      sizeA:            detailForm.sizeA,
      sizeB:            detailForm.sizeB,
      kousaTUpper: detailForm.kousaTUpper, kousaTLower: detailForm.kousaTLower,
      kousaAUpper: detailForm.kousaAUpper, kousaALower: detailForm.kousaALower,
      kousaBUpper: detailForm.kousaBUpper, kousaBLower: detailForm.kousaBLower,
      mentori4:         detailForm.mentori4,
      mentori8:         detailForm.mentori8,
      quantity:         detailForm.quantity,
      unitPrice:        calcResult.unitPrice,
      totalPrice:       calcResult.totalPrice,
      shortestDelivery: calcResult.shortestDelivery,
      deliveryDeadline: calcResult.deliveryDeadline,
      calculated:       true,
      intermediate:     calcResult.intermediate ?? undefined,
    }
    setDetails(prev => [...prev, newDetail])
    setDetailForm(EMPTY_DETAIL_FORM)
    setCalcResult(null)
    setCalcError("")
  }

  // 合計金額
  const grandTotal = details.reduce((sum, d) => sum + (d.totalPrice ?? 0), 0)

  // ── 明細削除 ──
  const handleDeleteDetail = useCallback((clientDetailId: string) => {
    if (!confirm("この明細を削除しますか？")) return
    setDetails(prev => prev.filter(d => d.clientDetailId !== clientDetailId))
  }, [])

  // ── 直送先検索 ──
  const handleDdSearch = async () => {
    setDdLoading(true); setDdError(""); setDdResults([])
    console.log("[直送先検索(Edit)] 検索条件:", ddSearch)
    try {
      const params = new URLSearchParams({
        ...(ddSearch.name    && { name:    ddSearch.name }),
        ...(ddSearch.address && { address: ddSearch.address }),
        ...(ddSearch.code    && { code:    ddSearch.code }),
        ...(ddSearch.tel     && { tel:     ddSearch.tel }),
      })
      const res = await fetch(`/api/v1/direct-deliveries/search?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      console.log("[直送先検索(Edit)] 結果:", data)
      setDdResults(data.results ?? [])
      if ((data.results ?? []).length === 0) setDdError("該当する直送先が見つかりませんでした")
    } catch (e: any) {
      setDdError("検索中にエラーが発生しました: " + e.message)
    } finally {
      setDdLoading(false)
    }
  }

  const handleDdSelect = (dd: DirectDelivery) => {
    console.log("[直送先選択(Edit)]", dd)
    setHeader(h => ({
      ...h,
      destinationCode:    dd.code,
      destinationName:    dd.name,
      destinationDept:    dd.department,
      destinationPerson:  dd.person,
      destinationZip:     dd.zipCode,
      destinationAddress: dd.address,
      destinationTel:     dd.tel,
      destinationFax:     dd.fax,
    }))
    setShowDDModal(false)
    setDdResults([])
    setDdSearch({ name: "", address: "", code: "", tel: "" })
  }

  // ── 保存（EditMode=Edit） ──
  const handleSave = async () => {
    setSaveMessage(null)
    if (!header.inputDate)    { setSaveMessage({ type: "error", text: "入力日付は必須です" }); return }
    if (details.length === 0) { setSaveMessage({ type: "error", text: "明細を1件以上入力してください" }); return }

    setSaveLoading(true)
    try {
      const payload = {
        estimateId:        estimateData.id,
        inputDate:         header.inputDate,
        customerOrderNo:   header.customerOrderNo || undefined,
        endUserNo:         header.endUserNo || undefined,
        destinationCode:    header.destinationCode || undefined,
        destinationName:    header.destinationName || undefined,
        destinationDept:    header.destinationDept || undefined,
        destinationPerson:  header.destinationPerson || undefined,
        destinationZip:     header.destinationZip || undefined,
        destinationAddress: header.destinationAddress || undefined,
        destinationTel:     header.destinationTel || undefined,
        destinationFax:     header.destinationFax || undefined,
        remarks:            header.remarks || undefined,
        editMode:           "Edit" as const,
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
          shortestDelivery:    d.shortestDelivery || undefined,
          deliveryDeadline:    d.deliveryDeadline ?? null,
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

      const res = await fetch(`/api/v1/estimates/${estimateData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        setSaveMessage({ type: "error", text: err.error ?? "保存に失敗しました" })
        return
      }

      setSaveMessage({ type: "success", text: "見積を更新しました" })
    } catch {
      setSaveMessage({ type: "error", text: "通信エラーが発生しました" })
    } finally {
      setSaveLoading(false)
    }
  }

  // ──────────────────────────────────────────────────────
  // render
  // ──────────────────────────────────────────────────────
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

      {/* ステータスバッジ */}
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          estimateData.estimateStatus === "saved"     ? "bg-blue-100 text-blue-700" :
          estimateData.estimateStatus === "ordered"   ? "bg-green-100 text-green-700" :
          estimateData.estimateStatus === "cancelled" ? "bg-red-100 text-red-600" :
          "bg-gray-100 text-gray-600"
        }`}>
          {estimateData.estimateStatus === "draft"     ? "下書き" :
           estimateData.estimateStatus === "saved"     ? "未処理" :
           estimateData.estimateStatus === "ordered"   ? "注文済" :
           estimateData.estimateStatus === "cancelled" ? "取消"  : estimateData.estimateStatus}
        </span>
        {estimateData.estimateNo && (
          <span className="text-sm text-gray-500">見積No: {estimateData.estimateNo}</span>
        )}
      </div>

      {/* 直送先検索モーダル */}
      {showDDModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDDModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-base">直送先検索</h3>
              <button onClick={() => setShowDDModal(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">直送先名</label>
                <input type="text" value={ddSearch.name}
                  onChange={e => setDdSearch(s => ({...s, name: e.target.value}))}
                  onKeyDown={e => e.key === "Enter" && handleDdSearch()}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="名称で検索" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">住所</label>
                <input type="text" value={ddSearch.address}
                  onChange={e => setDdSearch(s => ({...s, address: e.target.value}))}
                  onKeyDown={e => e.key === "Enter" && handleDdSearch()}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="住所で検索" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">直送先コード</label>
                <input type="text" value={ddSearch.code}
                  onChange={e => setDdSearch(s => ({...s, code: e.target.value}))}
                  onKeyDown={e => e.key === "Enter" && handleDdSearch()}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="コードで検索" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">TEL</label>
                <input type="text" value={ddSearch.tel}
                  onChange={e => setDdSearch(s => ({...s, tel: e.target.value}))}
                  onKeyDown={e => e.key === "Enter" && handleDdSearch()}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="電話番号で検索" />
              </div>
            </div>
            <button onClick={handleDdSearch} disabled={ddLoading}
              className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 mb-4">
              {ddLoading ? "検索中..." : "🔍 検索"}
            </button>
            {ddError && <p className="text-red-600 text-sm mb-3">{ddError}</p>}
            {ddResults.length > 0 && (
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">コード</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">名称</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">住所</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">TEL</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ddResults.map((dd, i) => (
                      <tr key={i} className="border-t border-gray-100 hover:bg-blue-50">
                        <td className="px-3 py-2 font-mono text-gray-600">{dd.code}</td>
                        <td className="px-3 py-2 text-gray-800">{dd.name}</td>
                        <td className="px-3 py-2 text-gray-600 max-w-[180px] truncate">{dd.address}</td>
                        <td className="px-3 py-2 text-gray-600">{dd.tel}</td>
                        <td className="px-2 py-2">
                          <button onClick={() => handleDdSelect(dd)}
                            className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                            選択
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ヘッダー情報 */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <p className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wide">ヘッダー情報</p>

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
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              入力日付 <span className="text-red-500">★</span>
            </label>
            <input type="date" value={header.inputDate}
              onChange={e => setHeader(h => ({ ...h, inputDate: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">お客様注文番号</label>
            <input type="text" value={header.customerOrderNo} maxLength={50}
              onChange={e => setHeader(h => ({ ...h, customerOrderNo: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">エンドユーザー番号</label>
            <input type="text" value={header.endUserNo} maxLength={50}
              onChange={e => setHeader(h => ({ ...h, endUserNo: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600">送り先名称</label>
              <button type="button"
                onClick={() => { console.log("[直送先検索ボタン(Edit)] クリック"); setShowDDModal(true) }}
                className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1">
                🔍 直送先検索
              </button>
            </div>
            <input type="text" value={header.destinationName} maxLength={80}
              onChange={e => setHeader(h => ({ ...h, destinationName: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">部署名</label>
            <input type="text" value={header.destinationDept} maxLength={50}
              onChange={e => setHeader(h => ({ ...h, destinationDept: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">担当者名</label>
            <input type="text" value={header.destinationPerson} maxLength={50}
              onChange={e => setHeader(h => ({ ...h, destinationPerson: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">郵便番号</label>
            <input type="text" value={header.destinationZip} maxLength={8}
              onChange={e => setHeader(h => ({ ...h, destinationZip: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="000-0000" />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">住所</label>
            <input type="text" value={header.destinationAddress} maxLength={200}
              onChange={e => setHeader(h => ({ ...h, destinationAddress: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">TEL</label>
            <input type="text" value={header.destinationTel} maxLength={15}
              onChange={e => setHeader(h => ({ ...h, destinationTel: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">FAX</label>
            <input type="text" value={header.destinationFax} maxLength={15}
              onChange={e => setHeader(h => ({ ...h, destinationFax: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">備考</label>
            <input type="text" value={header.remarks} maxLength={200}
              onChange={e => setHeader(h => ({ ...h, remarks: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </section>

      {/* ──────── 明細入力フォーム（STEP 20追加） ──────── */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          明細追加
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">材料 <span className="text-red-500">★</span></label>
              <select
                value={detailForm.materialCode}
                onChange={e => { console.log('[Edit][材料選択]', e.target.value); setDetailForm(p => ({ ...p, materialCode: e.target.value })); setCalcResult(null) }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- 材料を選択 --</option>
                {materials.map(m => (
                  <option key={m.materialCode} value={m.materialCode}>{m.materialCode} - {m.materialName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">加工仕様 <span className="text-red-500">★</span></label>
              <select
                value={detailForm.kakouShiyouCode || ""}
                onChange={e => { console.log('[Edit][加工仕様選択]', e.target.value); setDetailForm(p => ({ ...p, kakouShiyouCode: parseInt(e.target.value) || 0 })); setCalcResult(null) }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- 加工仕様を選択 --</option>
                {processingSpecs.map(s => (
                  <option key={s.processingSpecCode} value={s.processingSpecCode}>{s.processingSpecName}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">── 加工指示</p>
            <div className="grid grid-cols-3 gap-3">
              {(["T", "A", "B"] as const).map(axis => (
                <div key={axis}>
                  <label className="block text-xs text-gray-500 mb-1">{axis}面</label>
                  <select
                    value={detailForm[`kakouShijiCode${axis}` as keyof DetailForm] as string}
                    onChange={e => { console.log(`[Edit][加工指示${axis}]`, e.target.value); setDetailForm(p => ({ ...p, [`kakouShijiCode${axis}`]: e.target.value })); setCalcResult(null) }}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">選択</option>
                    {cuttingMethods.map(m => (
                      <option key={m.code} value={String(m.code)}>{m.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(["T", "A", "B"] as const).map(axis => (
              <div key={axis}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {axis === "T" ? "厚み T" : axis === "A" ? "幅 A" : "長さ B"} <span className="text-red-500">★</span>
                </label>
                <div className="flex items-center gap-1">
                  <input type="number" step="0.001" min="0.001" max="9999.999"
                    value={detailForm[`size${axis}` as keyof DetailForm] as string}
                    onChange={e => { console.log(`[Edit][寸法${axis}]`, e.target.value); setDetailForm(p => ({ ...p, [`size${axis}`]: e.target.value })); setCalcResult(null) }}
                    className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.000"
                  />
                  <span className="text-xs text-gray-400">mm</span>
                </div>
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">数量 <span className="text-red-500">★</span></label>
              <input type="number" min="1" step="1"
                value={detailForm.quantity}
                onChange={e => { console.log('[Edit][数量]', e.target.value); setDetailForm(p => ({ ...p, quantity: e.target.value })); setCalcResult(null) }}
                placeholder="1"
                className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400">── 公差</p>
              <button type="button" onClick={() => { console.log('[Edit][標準公差ボタン] クリック'); fetchStandardTolerance() }}
                className="text-xs px-2.5 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors">標準公差</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(["T", "A", "B"] as const).map(axis => (
                <div key={axis}>
                  <p className="text-[10px] text-gray-500 mb-1">{axis}面</p>
                  <div className="flex gap-1.5">
                    <input type="number" step="0.001" value={detailForm[`kousa${axis}Upper` as keyof DetailForm] as string}
                      onChange={e => { console.log(`[Edit][公差${axis}上限]`, e.target.value); setDetailForm(p => ({ ...p, [`kousa${axis}Upper`]: e.target.value })) }}
                      placeholder="上限" className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <input type="number" step="0.001" value={detailForm[`kousa${axis}Lower` as keyof DetailForm] as string}
                      onChange={e => { console.log(`[Edit][公差${axis}下限]`, e.target.value); setDetailForm(p => ({ ...p, [`kousa${axis}Lower`]: e.target.value })) }}
                      placeholder="下限" className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400">── 面取り</p>
              <button type="button" onClick={() => { console.log('[Edit][標準面取ボタン] クリック'); fetchStandardChamfer() }}
                className="text-xs px-2.5 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors">標準面取</button>
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-xs">
              {(["4", "8"] as const).map(n => (
                <div key={n}>
                  <p className="text-[10px] text-gray-500 mb-1">{n}面</p>
                  <input type="number" step="0.1" min="0"
                    value={detailForm[`mentori${n}` as keyof DetailForm] as string}
                    onChange={e => { console.log(`[Edit][面取${n}]`, e.target.value); setDetailForm(p => ({ ...p, [`mentori${n}`]: e.target.value })) }}
                    placeholder="0" className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              ))}
            </div>
          </div>
          {calcResult && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div><p className="text-blue-400">見積単価</p><p className="font-bold text-blue-800">¥{calcResult.unitPrice.toLocaleString()}</p></div>
              <div><p className="text-blue-400">見積金額</p><p className="font-bold text-blue-800">¥{calcResult.totalPrice.toLocaleString()}</p></div>
              <div><p className="text-blue-400">最短納期</p><p className="font-bold text-blue-800">{calcResult.shortestDelivery}</p></div>
              <div><p className="text-blue-400">有効期限</p><p className="font-bold text-blue-800">{calcResult.deliveryDeadline ? new Date(calcResult.deliveryDeadline).toLocaleDateString("ja-JP") : "—"}</p></div>
            </div>
          )}
          {calcError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">✕ {calcError}</p>
          )}
          <div className="flex flex-wrap gap-2 justify-end">
            <button type="button"
              onClick={() => { console.log('[Edit][入力クリアボタン] クリック'); setDetailForm(EMPTY_DETAIL_FORM); setCalcResult(null); setCalcError("") }}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">入力クリア</button>
            <button type="button"
              onClick={() => { console.log('[Edit][見積計算ボタン] クリック'); handleCalculate() }}
              disabled={calcLoading}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >{calcLoading ? "計算中..." : "📊 見積計算"}</button>
            <button type="button"
              onClick={() => { console.log('[Edit][明細追加ボタン] クリック'); handleAddDetail() }}
              disabled={!canAddDetail}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">＋ 明細に追加</button>
          </div>
        </div>
      </section>

      {/* 明細テーブル */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">見積明細</p>
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
                <th className="px-3 py-2 text-left text-gray-500 whitespace-nowrap">材料</th>
                <th className="px-3 py-2 text-left text-gray-500 whitespace-nowrap">加工仕様</th>
                <th className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">T</th>
                <th className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">A</th>
                <th className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">B</th>
                <th className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">数量</th>
                <th className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">単価</th>
                <th className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">金額</th>
                <th className="px-3 py-2 text-center text-gray-500 whitespace-nowrap">最短納期</th>
                <th className="px-3 py-2 text-center text-gray-500 whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {details.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-8 text-center text-gray-400">明細がありません</td>
                </tr>
              ) : details.map((d, i) => (
                <tr key={d.clientDetailId} className={i % 2 === 1 ? "bg-gray-50" : ""}>
                  <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                    {d.materialName || d.materialCode}
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{d.kakouShiyou || `コード:${d.kakouShiyouCode}`}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{d.sizeT}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{d.sizeA}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{d.sizeB}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{d.quantity}</td>
                  <td className="px-3 py-2 text-right text-gray-700">
                    {d.unitPrice != null ? `¥${d.unitPrice.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-blue-700">
                    {d.totalPrice != null ? `¥${d.totalPrice.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-600 whitespace-nowrap">
                    {d.shortestDelivery || "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => handleDeleteDetail(d.clientDetailId)}
                      className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 保存ボタン */}
      <div className="flex items-center gap-3 justify-end pt-2">
        <button
          onClick={() => router.push("/estimates")}
          className="px-5 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          キャンセル
        </button>
        <button
          onClick={handleSave}
          disabled={saveLoading || details.length === 0}
          className="px-6 py-2 text-sm font-medium rounded-lg bg-[#1a2744] text-white hover:bg-[#1a3a6e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saveLoading ? "保存中..." : "💾 更新保存"}
        </button>
      </div>
    </div>
  )
}