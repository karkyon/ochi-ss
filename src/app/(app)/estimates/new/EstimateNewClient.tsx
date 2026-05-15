"use client"
import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"

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
  customerOrderNo: string
  endUserNo: string
  destinationCode: string
  destinationName: string
  destinationDept: string
  destinationPerson: string
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

interface Props {
  materials: Material[]
  processingSpecs: ProcessingSpec[]
  userInfo: {
    customerCode: string
    customerName: string
    chargeName: string
    userId: string
  }
}

export default function EstimateNewClient({ materials, processingSpecs, userInfo }: Props) {
  const router = useRouter()
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

  // ヘッダーフォーム
  const [header, setHeader] = useState<HeaderForm>({
    inputDate:       todayStr(),
    customerOrderNo: "",
    endUserNo:       "",
    destinationCode: "",
    destinationName: "",
    destinationDept: "",
    destinationPerson: "",
    requestNouki:    "",
    remarks:         "",
  })

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
  const [details, setDetails] = useState<EstimateDetail[]>([])

  // UI状態
  const [calcLoading, setCalcLoading]   = useState(false)
  const [saveLoading, setSaveLoading]   = useState(false)
  const [calcError, setCalcError]       = useState("")
  const [saveMessage, setSaveMessage]   = useState<{ type: "success" | "error"; text: string } | null>(null)

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

    setDetails(prev => [...prev, newDetail])
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
        destinationPerson: header.destinationPerson || undefined,
        requestNouki:      header.requestNouki || undefined,
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
      setSaveMessage({ type: "success", text: `見積を保存しました（見積No: ${saved.estimateNo}）` })
      router.push(`/estimates/${saved.id}/edit`)
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
              onChange={e => setHeader(h => ({ ...h, inputDate: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              onChange={e => setHeader(h => ({ ...h, customerOrderNo: e.target.value }))}
              maxLength={50}
              placeholder="例: ORD-2026-001"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              onChange={e => setHeader(h => ({ ...h, endUserNo: e.target.value }))}
              maxLength={50}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                onChange={e => setHeader(h => ({ ...h, destinationCode: e.target.value }))}
                maxLength={20}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">送り先名</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={header.destinationName}
                  onChange={e => setHeader(h => ({ ...h, destinationName: e.target.value }))}
                  maxLength={100}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  className="px-3 py-2 text-xs rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 whitespace-nowrap transition-colors"
                  title="直送先検索（STEP12-D で実装）"
                >
                  🔍 直送先検索
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">希望納期</label>
              <input
                type="date"
                value={header.requestNouki}
                onChange={e => setHeader(h => ({ ...h, requestNouki: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">備考</label>
              <input
                type="text"
                value={header.remarks}
                onChange={e => setHeader(h => ({ ...h, remarks: e.target.value }))}
                maxLength={200}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              onChange={e => setDetailForm(p => ({ ...p, kakouShijiCodeT: e.target.value }))}
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
              onChange={e => setDetailForm(p => ({ ...p, kakouShijiCodeA: e.target.value }))}
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
              onChange={e => setDetailForm(p => ({ ...p, kakouShijiCodeB: e.target.value }))}
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
                      setDetailForm(p => ({ ...p, [`size${axis}`]: e.target.value }))
                      setCalcResult(null)
                    }}
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
              onClick={fetchStandardTolerance}
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
                    onChange={e => setDetailForm(p => ({ ...p, [`kousa${axis}Upper`]: e.target.value }))}
                    placeholder="上限"
                    className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    step="0.001"
                    value={detailForm[`kousa${axis}Lower` as keyof DetailForm]}
                    onChange={e => setDetailForm(p => ({ ...p, [`kousa${axis}Lower`]: e.target.value }))}
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
              onClick={fetchStandardChamfer}
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
                  onChange={e => setDetailForm(p => ({ ...p, mentori4: e.target.value }))}
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
                  onChange={e => setDetailForm(p => ({ ...p, mentori8: e.target.value }))}
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
                  setDetailForm(p => ({ ...p, quantity: e.target.value }))
                  setCalcResult(null)
                }}
                placeholder="1"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            onClick={handleCalculate}
            disabled={calcLoading}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {calcLoading ? "計算中..." : "📊 見積計算"}
          </button>
          <button
            type="button"
            onClick={handleAddDetail}
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
                        onClick={() => handleDeleteDetail(d.clientDetailId)}
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

          {/* 保存ボタン */}
          <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleSave}
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