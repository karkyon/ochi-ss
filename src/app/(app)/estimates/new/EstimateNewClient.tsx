// src/app/(app)/estimates/new/EstimateNewClient.tsx
"use client"

// HTTP環境（non-SecureContext）でも動くUUID生成
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
    return (crypto as any).randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// 郵便番号正規化: 数字7桁を抽出し、不足分は末尾に0補完
function normalizeZip(input: string): string {
  const digits = input.replace(/\D/g, "")
  if (!digits) return ""
  const padded = digits.padEnd(7, "0").slice(0, 7)
  return `${padded.slice(0, 3)}-${padded.slice(3)}`
}
// 郵便番号APIに渡す7桁数字
function zipDigits(zip: string): string { return zip.replace(/\D/g, "").slice(0, 7) }

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"

// ─── 型定義 ───────────────────────────────────────────────────
interface Material  { materialCode: string; materialName: string }
interface ProcSpec  {
  processingSpecCode: number
  processingSpecName: string
  kakouShijiT: string  // "W" / "RG" / "〜" / "SG"
  kakouShijiA: string
  kakouShijiB: string
}
interface CutMethod { code: number; label: string }
interface UserInfo  { customerId: string; customerCode: string; userName: string; companyName: string }

interface DetailForm {
  clientDetailId: string
  materialCode: string
  kakouShiyouCode: number
  kakouShijiCodeT: string; kakouShijiCodeA: string; kakouShijiCodeB: string
  shiagari: string
  sizeT: number; sizeB: number; sizeA: number
  toleranceTUp: number; toleranceTDown: number
  toleranceBUp: number; toleranceBDown: number
  toleranceAUp: number; toleranceADown: number
  mentoriShiji: number
  mentori4: number; mentori8: number
  quantity: number
  customerDetailOrderNo: string; destinationDetailOrderNo: string; remarks: string
  unitPrice?: number; totalPrice?: number
  deliveryDate?: string; deliveryDeadline?: string | null
  fastDeliveryDate?: string; fastDeliveryDeadline?: string
  calculated?: boolean
  // 注文済み情報
  isOrdered?: boolean        // 注文済みフラグ
  orderedOrderNo?: string    // 注文番号
  // 履歴
  historyLog?: Array<{ at: string; action: string; detail: string }>
}

interface Props {
  materials: Material[]; processingSpecs: ProcSpec[]
  cuttingMethods: any[]
  userInfo: UserInfo; copySource?: any; isCopy?: boolean
}

// ─── ヘルパー ──────────────────────────────────────────────────
function newForm(): DetailForm {
  return {
    clientDetailId: generateUUID(),
    materialCode: "", kakouShiyouCode: 0,
    kakouShijiCodeT: "W", kakouShijiCodeA: "W", kakouShijiCodeB: "W",
    shiagari: "",
    sizeT: 0, sizeB: 0, sizeA: 0,
    toleranceTUp: 0, toleranceTDown: 0,
    toleranceBUp: 0, toleranceBDown: 0,
    toleranceAUp: 0, toleranceADown: 0,
    mentoriShiji: 9, mentori4: 0, mentori8: 0,
    quantity: 1,
    customerDetailOrderNo: "", destinationDetailOrderNo: "", remarks: "",
    calculated: false,
  }
}
function isExpired(d?: string | null) { return !!d && new Date(d) < new Date() }
// 納期保証期限までの残り時間をラベル化する（UIUX強化: あと何分/何時間/何日かを色分け表示）
function remainingLabel(deadline?: string | null): { text: string; color: string } {
  if (!deadline) return { text: "—", color: "#94a3b8" }
  const diffMs = new Date(deadline).getTime() - Date.now()
  if (diffMs <= 0) return { text: "期限切れ", color: "#ef4444" }
  const totalMin = Math.floor(diffMs / 60000)
  if (totalMin < 60) return { text: `あと${totalMin}分`, color: totalMin <= 15 ? "#ef4444" : "#f59e0b" }
  const hours = Math.floor(totalMin / 60)
  if (hours < 24) return { text: `あと${hours}時間${totalMin % 60}分`, color: hours <= 2 ? "#f59e0b" : "#166534" }
  const days = Math.floor(hours / 24)
  return { text: `あと${days}日`, color: "#166534" }
}
function fmt(iso?: string | null) { return iso ? iso.slice(0, 10) : "" }
function fmtDt(iso?: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  if (iso.length <= 10) return iso.slice(0, 10)
  const dateStr = iso.slice(0, 10)
  const h = String(d.getHours()).padStart(2, "0")
  const m = String(d.getMinutes()).padStart(2, "0")
  return `${dateStr} ${h}:${m}`
}
// ── 明細パターン判定 ──────────────────────────────────────────
// 1: 金額算出不可 / 2: 金額OK・納期未算出 / 3: 金額・納期両方OK
function detailPattern(d: { unitPrice?: number; totalPrice?: number; fastDeliveryDate?: string; deliveryDeadline?: string | null }): 1 | 2 | 3 {
  const hasPrice = (d.unitPrice ?? 0) > 0
  if (!hasPrice) return 1
  const hasDelivery = !!d.fastDeliveryDate && d.fastDeliveryDate !== ""
  if (!hasDelivery) return 2
  // 納期保証期限切れは注文不可（パターン2扱い）
  if (d.deliveryDeadline && new Date(d.deliveryDeadline) < new Date()) return 2
  return 3
}

function allCutsDefined(t: string, a: string, b: string): boolean {
  return t !== "〜" && a !== "〜" && b !== "〜"
}

// ─── スタイル定数 ─────────────────────────────────────────────
const TH: React.CSSProperties = {
  background: "#1e3a5f", color: "#fff", fontSize: "12px", fontWeight: 600,
  padding: "3px 2px", textAlign: "center", border: "1px solid #334155", whiteSpace: "nowrap",
}
const TD: React.CSSProperties = {
  border: "1px solid #e2e8f0", padding: "2px 3px", verticalAlign: "middle",
}
const INP: React.CSSProperties = {
  width: "100%", border: "1.5px solid #94a3b8", borderRadius: "4px",
  padding: "2px 4px", fontSize: "13px", background: "#ffffff", boxSizing: "border-box", height: "28px",
  boxShadow: "inset 0 1px 2px rgba(15,23,42,0.06)",
}
const SEL: React.CSSProperties = {
  width: "100%", border: "1.5px solid #94a3b8", borderRadius: "4px",
  padding: "1px 2px", fontSize: "13px", background: "#ffffff", height: "28px",
  boxShadow: "inset 0 1px 2px rgba(15,23,42,0.06)",
}
const LBL: React.CSSProperties = {
  background: "#e8edf5", fontSize: "12px", fontWeight: 600, color: "#374151",
  padding: "3px 6px", border: "1px solid #d1d5db", whiteSpace: "nowrap",
}
const TOL_INP: React.CSSProperties = {
  ...INP, height: "26px", fontSize: "12px", textAlign: "right", padding: "1px 3px",
}
const FH = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.background = "#ffffcc"; e.target.style.borderColor = "#f59e0b"
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.background = "#fff"; e.target.style.borderColor = "#cbd5e1"
  },
}

function focusById(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  ;(el as HTMLElement).focus()
  if ((el as any).select) (el as HTMLInputElement).select()
}
function onEnter(nextId: string) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); focusById(nextId) }
  }
}
// 材料・仕様サジェストの一致判定用: 大文字小文字・前後空白の差異を無視して比較する。
// (実運用で "ss400" 等の小文字入力が "SS400" と一致せず、materialCodeが
//  空のまま計算APIへ送信される不具合の再発防止)
function normalizeForMatch(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase()
}

// ─── メインコンポーネント ────────────────────────────────────
export default function EstimateNewClient({ materials, processingSpecs: initSpecs, userInfo, copySource, isCopy }: Props) {
  const today = new Date().toISOString().slice(0, 10)

  // ヘッダー状態
  const [estimateNo, setEstimateNo]   = useState("")
  const [orderNo, setOrderNo]         = useState("")
  const [inputDate, setInputDate]     = useState(today)
  const [estimateDate, setEstimateDate] = useState(today)
  const [custOrderNo, setCustOrderNo] = useState("")
  const [endUserNo, setEndUserNo]     = useState("")
  const [distCode, setDistCode]       = useState("")
  const [distId, setDistId]           = useState<string | null>(null)  // マスタから呼び出したレコードID
  const [distOriginal, setDistOriginal] = useState<Record<string,string> | null>(null) // 呼び出し時スナップショット
  const [showDistModal, setShowDistModal] = useState(false)  // 出荷先検索モーダル表示フラグ
  const [distModalKw, setDistModalKw] = useState("")         // モーダル内検索キーワード
  const [distModalRows, setDistModalRows] = useState<any[]>([]) // モーダル検索結果
  const [distName, setDistName]       = useState("")
  const [distDept, setDistDept]       = useState("")
  const [distPerson, setDistPerson]   = useState("")
  const [distZip, setDistZip]         = useState("")
  const [distAddr, setDistAddr]       = useState("")
  const [distTel, setDistTel]         = useState("")
  const [distFax, setDistFax]         = useState("")
  const [contact, setContact]         = useState("")
  const [shippingMethod, setShippingMethod] = useState("発送")

  // 明細状態
  const [form, setForm]       = useState<DetailForm>(newForm())

  // ── 公差・面取り 表示用文字列バッファ ──
  // number state(form.toleranceXxx等)を直接inputのvalueにバインドすると
  // 0が空欄表示になったり、"0.1"等の入力中に先頭の0が消える不具合が出るため、
  // 表示はこの文字列バッファで保持し、blur時にのみ form へ数値反映する。
  type TolKey = "toleranceTUp" | "toleranceTDown" | "toleranceAUp" | "toleranceADown" | "toleranceBUp" | "toleranceBDown" | "mentori4" | "mentori8"
  const [tolInputs, setTolInputs] = useState<Record<TolKey, string>>({
    toleranceTUp: "0.00", toleranceTDown: "0.00",
    toleranceAUp: "0.00", toleranceADown: "0.00",
    toleranceBUp: "0.00", toleranceBDown: "0.00",
    mentori4: "0.0", mentori8: "0.0",
  })
  // form側の数値が外部要因（標準公差/標準面取/新規/クリア/コピー読込）で
  // 変化した場合に、表示文字列バッファを追従させる
  useEffect(() => {
    // 文字列バッファの「数値としての値」がform側と既に一致していれば、
    // 入力中の表示文字列（"0.10"等の末尾0や途中入力）を保持するため上書きしない。
    // 標準公差/標準面取/新規/クリア/コピー読込のように値そのものが変わった
    // ときだけ文字列バッファを同期する。
    setTolInputs(prev => {
      const next = { ...prev }
      const pairs: Array<[TolKey, number]> = [
        ["toleranceTUp", form.toleranceTUp], ["toleranceTDown", form.toleranceTDown],
        ["toleranceAUp", form.toleranceAUp], ["toleranceADown", form.toleranceADown],
        ["toleranceBUp", form.toleranceBUp], ["toleranceBDown", form.toleranceBDown],
        ["mentori4", form.mentori4], ["mentori8", form.mentori8],
      ]
      let changed = false
      for (const [key, numVal] of pairs) {
        const currentParsed = parseFloat(prev[key])
        if (Number.isNaN(currentParsed) || currentParsed !== numVal) {
          const digits = key.startsWith("mentori") ? 1 : 2
          next[key] = numVal.toFixed(digits)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [form.toleranceTUp, form.toleranceTDown, form.toleranceAUp, form.toleranceADown, form.toleranceBUp, form.toleranceBDown, form.mentori4, form.mentori8])

  // 公差・面取り共通の入力ハンドラ生成
  // 入力中は文字列バッファのみ更新（自由に "0.1" "0.01" 等を打てる）。
  // 数値として確定できる場合は form 側にも即時反映（計算時に正しい値を使うため）。
  const makeTolHandler = useCallback((key: TolKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setTolInputs(prev => ({ ...prev, [key]: raw }))
    // "-" や "0." のような未確定の途中入力はform更新をスキップ（NaN化を防ぐ）
    if (raw === "" || raw === "-" || raw === "." || raw === "-.") {
      setForm(f => ({ ...f, [key]: 0 }))
      return
    }
    const parsed = parseFloat(raw)
    if (!Number.isNaN(parsed)) {
      setForm(f => ({ ...f, [key]: parsed }))
    }
  }, [])
  // blur時: 文字列バッファを正規化。
  // 公差(toleranceXxx)は小数第2位固定、面取り(mentoriXxx)は小数第1位固定で
  // 表示する（"1.0"が"1"に省略される、"0.10"が"0.1"に省略される、等を防止）。
  const makeTolBlur = useCallback((key: TolKey) => () => {
    setTolInputs(prev => {
      const parsed = parseFloat(prev[key])
      if (Number.isNaN(parsed)) return { ...prev, [key]: key.startsWith("mentori") ? "0.0" : "0.00" }
      const digits = key.startsWith("mentori") ? 1 : 2
      const normalized = parsed.toFixed(digits)
      return { ...prev, [key]: normalized }
    })
  }, [])
  const [details, setDetails] = useState<DetailForm[]>([])
  // 見積計算の二重送信防止フラグ（連打・Enter二重発火によるSQL Server側
  // _TMP_WO基準納期設定 の同時実行競合(PK違反)を防止するため追加）
  const [calcLoading, setCalcLoading] = useState(false)
  // 二重送信ガード(ref版): stateの再描画タイミングに依存せず同期的に
  // 多重実行をブロックするための補助フラグ
  const calcInFlightRef = useRef(false)
  // 見積計算エラーの詳細メッセージ。ブラウザ標準alert()は「システム異常」に
  // 見えて誤解を招くため、フォーム内にインラインで分かりやすく表示する
  const [calcError, setCalcError] = useState<string | null>(null)
  // 編集中の明細ID。nullなら新規追加モード、値があれば「その行を編集中」で
  // 「明細に追加」ボタンが「明細を更新」に変わり、更新時は該当行を
  // 配列内の同じ位置で上書きする（削除して末尾に追加、ではない）。
  const [editingDetailId, setEditingDetailId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving]   = useState(false)
  const [saveMsg, setSaveMsg] = useState("")
  const [draftId, setDraftId] = useState<string | null>(null)
  const [historyModal, setHistoryModal] = useState<{ id: string; log: Array<{ at: string; action: string; detail: string }> } | null>(null)

  // マスタ（DBから取得したProcSpecにT/A/B列含む）
  const [procSpecs, setProcSpecs] = useState<ProcSpec[]>(initSpecs)
  const [matProcMap, setMatProcMap] = useState<Record<string, number[]>>({})
  const [matSuggest, setMatSuggest] = useState("")
  const [specSuggest, setSpecSuggest] = useState("")
  const matInputRef = useRef<HTMLInputElement>(null)

  // ── 初期処理 ──
  useEffect(() => {
    console.log("[EstimateNewClient] 初期処理開始")
    console.log("[EstimateNewClient] userInfo:", JSON.stringify(userInfo))
    console.log("[EstimateNewClient] materials件数:", materials.length)
    console.log("[EstimateNewClient] processingSpecs件数:", initSpecs.length)

    // WO加工仕様マスタをDBから取得（SQLServer→PostgreSQL同期含む）
    fetch("/api/v1/masters/processing-specs")
      .then(r => r.json())
      .then(d => {
        console.log("[EstimateNewClient][processing-specs] レスポンス:", JSON.stringify(d))
        if (d.specs && d.specs.length > 0) {
          setProcSpecs(d.specs)
          console.log(`[EstimateNewClient][processing-specs] ${d.specs.length}件セット, SQLServer同期: ${d.syncedFromSqlServer}`)
        }
      })
      .catch(e => console.error("[EstimateNewClient][processing-specs] エラー:", e))

    // 材料×加工仕様マップ
    fetch("/api/v1/masters/material-processing-map")
      .then(r => r.json())
      .then(d => {
        console.log("[EstimateNewClient][material-processing-map] レスポンス件数:", Object.keys(d.map || {}).length)
        if (d.map) setMatProcMap(d.map)
      })
      .catch(e => console.error("[EstimateNewClient][material-processing-map] エラー:", e))

    console.log("[EstimateNewClient] 初期フォーム値:", JSON.stringify(newForm()))
  }, [])

  // ── copySource（編集呼び出し）があればヘッダー・明細を復元 ──
  useEffect(() => {
    if (!copySource) return
    console.log("[EstimateNewClient] copySource復元開始:", JSON.stringify(copySource))
    // コピーモード(isCopy=true)の場合はdraftIdをセットしない（新規POSTで別伝票を作成）
    // 編集モード(isCopy=false)のみdraftIdをセットしてPUT更新にする
    if (!isCopy) {
      if (copySource.estimateId) setDraftId(copySource.estimateId)
      if (copySource.estimateNo) setEstimateNo(copySource.estimateNo)
    }
    if (copySource.customerOrderNo)   setCustOrderNo(copySource.customerOrderNo)
    if (copySource.endUserNo)         setEndUserNo(copySource.endUserNo)
    if (copySource.destinationCode) {
      setDistCode(copySource.destinationCode)
      setDistId("__existing__")
      setDistOriginal({ name: copySource.destinationName ?? "", dept: copySource.destinationDept ?? "", person: copySource.destinationPerson ?? "", zip: copySource.destinationZip ?? "", addr: copySource.destinationAddress ?? "", tel: copySource.destinationTel ?? "", fax: copySource.destinationFax ?? "" })
    } else if (copySource.destinationName) {
      setDistId("__existing__")
      setDistOriginal({ name: copySource.destinationName ?? "", dept: copySource.destinationDept ?? "", person: copySource.destinationPerson ?? "", zip: copySource.destinationZip ?? "", addr: copySource.destinationAddress ?? "", tel: copySource.destinationTel ?? "", fax: copySource.destinationFax ?? "" })
    }
    if (copySource.destinationName)   setDistName(copySource.destinationName)
    if (copySource.destinationDept)   setDistDept(copySource.destinationDept)
    if (copySource.destinationPerson) setDistPerson(copySource.destinationPerson)
    if (copySource.destinationZip)    setDistZip(copySource.destinationZip)
    if (copySource.destinationAddress) setDistAddr(copySource.destinationAddress)
    if (copySource.destinationTel)    setDistTel(copySource.destinationTel)
    if (copySource.destinationFax)    setDistFax(copySource.destinationFax)
    if (copySource.contact)           setContact(copySource.contact)
    if (copySource.shippingMethod) {
      const sm = copySource.shippingMethod === "1" ? "発送"
               : copySource.shippingMethod === "2" ? "直送"
               : copySource.shippingMethod === "3" ? "引取り"
               : "発送"
      setShippingMethod(sm)
    }
    if (copySource.details?.length > 0) {
      const restored = copySource.details.map((d: any) => ({
        clientDetailId:   d.clientDetailId || generateUUID(),
        materialCode:     d.materialCode     ?? "",
        kakouShiyouCode:  d.kakouShiyouCode  ?? 0,
        kakouShijiCodeT:  d.kakouT           ?? "W",
        kakouShijiCodeA:  d.kakouA           ?? "W",
        kakouShijiCodeB:  d.kakouB           ?? "W",
        shiagari:         d.shiagari         ?? "",
        sizeT:  Number(d.sizeT  ?? 0),
        sizeB:  Number(d.sizeB  ?? 0),
        sizeA:  Number(d.sizeA  ?? 0),
        toleranceTUp:   Number(d.toleranceTUp   ?? 0),
        toleranceTDown: Number(d.toleranceTDown ?? 0),
        toleranceBUp:   Number(d.toleranceBUp   ?? 0),
        toleranceBDown: Number(d.toleranceBDown ?? 0),
        toleranceAUp:   Number(d.toleranceAUp   ?? 0),
        toleranceADown: Number(d.toleranceADown ?? 0),
        mentoriShiji:   Number(d.mentoriShiji   ?? 9),
        mentori4:  Number(d.mentori4  ?? 0),
        mentori8:  Number(d.mentori8  ?? 0),
        quantity:  Number(d.quantity  ?? 1),
        customerDetailOrderNo:    d.customerDetailOrderNo    ?? "",
        destinationDetailOrderNo: d.destinationDetailOrderNo ?? "",
        remarks:   d.remarks   ?? "",
        unitPrice:  Number(d.unitPrice  ?? 0),
        totalPrice: Number(d.totalPrice ?? 0),
        deliveryDate:     d.deliveryDate     ?? undefined,
        deliveryDeadline: d.deliveryDeadline ?? null,
        fastDeliveryDate:     d.deliveryDate     ?? undefined,
        fastDeliveryDeadline: d.deliveryDeadline ?? undefined,
        calculated: true,
      }))
      setDetails(restored)
      console.log("[EstimateNewClient] copySource明細復元:", restored.length, "件")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copySource])

  const filteredSpecs: ProcSpec[] = form.materialCode && matProcMap[form.materialCode]
    ? procSpecs.filter(s => matProcMap[form.materialCode].includes(s.processingSpecCode))
    : procSpecs

  // ── 仕上り選択: DBのkakou_shiji列から加工指示を設定 ──
  const handleSpecSelect = useCallback((spec: ProcSpec, skipToSizeIfAllDefined = false) => {
    const cuts = { t: spec.kakouShijiT || "W", a: spec.kakouShijiA || "W", b: spec.kakouShijiB || "W" }
    console.log(`[handleSpecSelect] spec:`, JSON.stringify(spec), "cuts:", JSON.stringify(cuts))
    setForm(f => ({
      ...f,
      kakouShiyouCode: spec.processingSpecCode,
      shiagari: spec.processingSpecName,
      kakouShijiCodeT: cuts.t,
      kakouShijiCodeA: cuts.a,
      kakouShijiCodeB: cuts.b,
      calculated: false,
    }))
    setSpecSuggest(spec.processingSpecName)
    if (skipToSizeIfAllDefined && allCutsDefined(cuts.t, cuts.a, cuts.b)) {
      setTimeout(() => focusById("f-sizeT"), 50)
    }
  }, [])

  // ── 材料選択: 6F(コード2)優先 ──
  const handleMaterialSelect = useCallback((code: string) => {
    const matName = materials.find(m => m.materialCode === code)?.materialName ?? code
    console.log(`[handleMaterialSelect] materialCode: ${code}, materialName: ${matName}`)
    setMatSuggest(matName)
    const avail = code && matProcMap[code]
      ? procSpecs.filter(s => matProcMap[code].includes(s.processingSpecCode))
      : procSpecs
    console.log(`[handleMaterialSelect] 利用可能スペック件数: ${avail.length}`, avail.map(s => `${s.processingSpecCode}:${s.processingSpecName}`))
    // デフォルト: コード2(6F)を優先、なければ名前に"6F"含む最初のスペック
    const def = avail.find(s => s.processingSpecCode === 2)
      ?? avail.find(s => s.processingSpecName?.startsWith("6F"))
      ?? avail[0]
    console.log(`[handleMaterialSelect] デフォルトスペック:`, JSON.stringify(def))
    if (def) {
      const cuts = { t: def.kakouShijiT || "W", a: def.kakouShijiA || "W", b: def.kakouShijiB || "W" }
      setForm(f => ({
        ...f,
        materialCode: code,
        kakouShiyouCode: def.processingSpecCode,
        shiagari: def.processingSpecName,
        kakouShijiCodeT: cuts.t,
        kakouShijiCodeA: cuts.a,
        kakouShijiCodeB: cuts.b,
        calculated: false,
      }))
      setSpecSuggest(def.processingSpecName)
    } else {
      setForm(f => ({ ...f, materialCode: code, calculated: false }))
    }
    setTimeout(() => focusById("f-shiagari"), 50)
  }, [materials, procSpecs, matProcMap])

  // ── 標準公差 ──
  const handleStdTol = useCallback(async () => {
    const params = {
      customerCode: userInfo.customerCode,
      kakouShiyouCode: form.kakouShiyouCode,
      sizeT: form.sizeT, sizeB: form.sizeB, sizeA: form.sizeA,
    }
    console.log("[handleStdTol] リクエスト:", JSON.stringify(params))
    try {
      const url = `/api/v1/tolerance/standard?customerCode=${params.customerCode}&kakouShiyouCode=${params.kakouShiyouCode}&sizeT=${params.sizeT}&sizeB=${params.sizeB}&sizeA=${params.sizeA}`
      const res = await fetch(url)
      const d = await res.json()
      console.log("[handleStdTol] レスポンス:", JSON.stringify(d))
      if (d.success || d.tolerance) {
        const t = d.tolerance ?? d
        const newTol = {
          toleranceTUp: t.tUpper ?? 0, toleranceTDown: t.tLower ?? 0,
          toleranceBUp: t.bUpper ?? 0, toleranceBDown: t.bLower ?? 0,
          toleranceAUp: t.aUpper ?? 0, toleranceADown: t.aLower ?? 0,
        }
        console.log("[handleStdTol] 設定値:", JSON.stringify(newTol))
        setForm(f => ({ ...f, ...newTol }))
      }
    } catch(e: any) { console.error("[handleStdTol] エラー:", e.message) }
    setTimeout(() => focusById("btn-std-chamfer"), 100)
  }, [userInfo.customerCode, form.kakouShiyouCode, form.sizeT, form.sizeB, form.sizeA])

  // ── 標準面取り ──
  const handleStdChamfer = useCallback(async () => {
    const params = { customerCode: userInfo.customerCode }
    console.log("[handleStdChamfer] リクエスト:", JSON.stringify(params))
    try {
      const res = await fetch(`/api/v1/chamfer/standard?customerCode=${params.customerCode}`)
      const d = await res.json()
      console.log("[handleStdChamfer] レスポンス:", JSON.stringify(d))
      if (d.success || d.chamfer) {
        const c = d.chamfer ?? d
        const newChamfer = { mentori4: c.chamfer4 ?? 0, mentori8: c.chamfer8 ?? 0 }
        console.log("[handleStdChamfer] 設定値:", JSON.stringify(newChamfer))
        setForm(f => ({ ...f, ...newChamfer }))
      }
    } catch(e: any) { console.error("[handleStdChamfer] エラー:", e.message) }
    setTimeout(() => focusById("f-qty"), 100)
  }, [userInfo.customerCode])

  // ── 計算 ──
  const handleCalculate = async () => {
    // 二重送信ガード(ref版): 再描画を待たず即座に多重実行をブロックする
    if (calcInFlightRef.current) {
      console.warn("[handleCalculate] 直前の呼び出しが処理中のため多重実行をブロックしました(ref)")
      return
    }
    calcInFlightRef.current = true
    // 二重送信ガード(state版): 計算中の再クリック/Enter二重発火を無視する
    if (calcLoading) {
      console.warn("[handleCalculate] 計算処理中のため多重実行をブロックしました")
      calcInFlightRef.current = false
      return
    }
    const spec = procSpecs.find(s => s.processingSpecCode === form.kakouShiyouCode)
    const payload = {
      customerCode: userInfo.customerCode,
      materialCode: form.materialCode,
      kakouShiyouCode: form.kakouShiyouCode,
      kakouShiyou: spec?.processingSpecName ?? "",
      kakouShijiCodeT: form.kakouShijiCodeT,
      kakouShijiCodeA: form.kakouShijiCodeA,
      kakouShijiCodeB: form.kakouShijiCodeB,
      kakouT: form.kakouShijiCodeT,
      kakouA: form.kakouShijiCodeA,
      kakouB: form.kakouShijiCodeB,
      sizeT: form.sizeT, sizeB: form.sizeB, sizeA: form.sizeA,
      kousaTUpper: form.toleranceTUp, kousaTLower: form.toleranceTDown,
      kousaBUpper: form.toleranceBUp, kousaBLower: form.toleranceBDown,
      kousaAUpper: form.toleranceAUp, kousaALower: form.toleranceADown,
      mentoriShiji: String(form.mentoriShiji),
      mentori4: form.mentori4, mentori8: form.mentori8,
      quantity: form.quantity,
    }
    const url = "/api/v1/estimates/calculate"
    console.log("========== [handleCalculate] REQUEST ==========")
    console.log("[handleCalculate] URL:", url, "METHOD: POST")
    console.log("[handleCalculate] payload全内容:", JSON.stringify(payload, null, 2))
    console.log("==================================================")
    if (!form.materialCode || !form.kakouShiyouCode) { calcInFlightRef.current = false; setCalcError("材料と加工仕様を選択してください"); return }
    if (!form.sizeT || !form.sizeB || !form.sizeA) { calcInFlightRef.current = false; setCalcError("寸法（厚み・巾・長さ）を入力してください"); return }
    setCalcError(null)
    setCalcLoading(true)
    try {
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const resHeaders: Record<string, string> = {}
      res.headers.forEach((v, k) => { resHeaders[k] = v })
      let data: any
      const rawText = await res.text()
      try { data = JSON.parse(rawText) } catch { data = { rawText } }
      console.log("========== [handleCalculate] RESPONSE ==========")
      console.log("[handleCalculate] HTTPステータス:", res.status, res.statusText)
      console.log("[handleCalculate] レスポンスヘッダー:", JSON.stringify(resHeaders, null, 2))
      console.log("[handleCalculate] レスポンスBody:", JSON.stringify(data, null, 2))
      if (data.ssmsExecSql) {
        console.log("\n========== [SSMS貼り付け用EXEC文] ここからコピー ==========")
        console.log(data.ssmsExecSql)
        console.log("========== [SSMS貼り付け用EXEC文] ここまでコピー ==========")
      }
      console.log("====================================================")
      if (!res.ok) {
        // 422等はAPI側で原因(材料サイズが範囲外/該当データなし等)を具体的に返す。
        // ブラウザ標準alertは使わず、フォーム内にそのまま表示する。
        setCalcError(data.error ?? `計算に失敗しました（HTTP ${res.status}）`)
        return
      }
      // route.ts の実レスポンス構造: { unitPrice, sumPrice, shortestDelivery, deliveryDeadline }
      // 旧コードは存在しないフィールド(totalPrice/deliveryDate/fastDeliveryDate等)を
      // 参照していたため、送料込みプレート金額・最短納期が常に未設定だった。
      if (!data.shortestDelivery) {
        console.warn("[handleCalculate] shortestDelivery が空文字。SP側で当該組合せの納期が算出されなかった可能性があります。")
      }
      setCalcError(null)
      setForm(f => ({
        ...f,
        unitPrice: data.unitPrice,
        totalPrice: data.sumPrice,
        deliveryDate: data.shortestDelivery || undefined,
        deliveryDeadline: data.deliveryDeadline,
        fastDeliveryDate: data.shortestDelivery || undefined,
        fastDeliveryDeadline: data.deliveryDeadline ?? undefined,
        calculated: true,
      }))
      setTimeout(() => focusById("btn-add"), 50)
    } catch (e: any) {
      console.error("========== [handleCalculate] エラー全詳細 ==========")
      console.error("name:", e?.name)
      console.error("message:", e?.message)
      console.error("stack:", e?.stack)
      try { console.error("全プロパティ:", JSON.stringify(e, Object.getOwnPropertyNames(e), 2)) } catch { /* noop */ }
      console.error("=======================================================")
      setCalcError("通信エラーが発生しました: " + (e?.message ?? "不明なエラー"))
    } finally {
      setCalcLoading(false)
      calcInFlightRef.current = false
    }
  }

  // 「明細に追加」(新規)と「明細を更新」(編集中)を統合したハンドラ。
  // editingDetailId が設定されていれば、details配列内の該当行を
  // 同じ位置でフォーム内容に上書きする（編集前の行順・Noを維持）。
  // 未設定なら末尾に新規追加する（従来通り）。
  const handleAdd = () => {
    if (!form.calculated) return
    if (editingDetailId) {
      console.log("[handleAdd] 明細更新 id:", editingDetailId, JSON.stringify(form, null, 2))
      const editLog = { at: new Date().toISOString(), action: "編集", detail: `材料:${form.materialCode} T:${form.sizeT} A:${form.sizeA} B:${form.sizeB} 数量:${form.quantity}` }
      setDetails(p => p.map(d => d.clientDetailId === editingDetailId ? { ...form, clientDetailId: editingDetailId, historyLog: [...(d.historyLog ?? []), editLog] } : d))
      setEditingDetailId(null)
    } else {
      console.log("[handleAdd] 明細追加:", JSON.stringify(form, null, 2))
      const addLog = { at: new Date().toISOString(), action: "新規追加", detail: `材料:${form.materialCode} T:${form.sizeT} A:${form.sizeA} B:${form.sizeB} 数量:${form.quantity}` }
      setDetails(p => [...p, { ...form, historyLog: [addLog] }])
    }
    const m = form.materialCode
    const matName = materials.find(x => x.materialCode === m)?.materialName ?? ""
    setForm({ ...newForm(), materialCode: m })
    setMatSuggest(matName); setSpecSuggest("")
    setTimeout(() => focusById("f-mat-suggest"), 50)
  }
  // ── 明細行 編集 ──
  // 対象行は一覧にそのまま残し、内容をフォームへ復元するのみ。
  // editingDetailId をセットすることで「明細に追加」ボタンが
  // 「明細を更新」に変わり、再計算後の更新時に該当行を同じ位置で
  // 上書きする（削除して再追加ではない）。
  const handleEditDetail = (id: string) => {
    const target = details.find(d => d.clientDetailId === id)
    if (!target) return
    console.log("[handleEditDetail] 編集対象 id:", id, JSON.stringify(target, null, 2))
    setForm({ ...target, calculated: false })
    setTolInputs({
      toleranceTUp: target.toleranceTUp.toFixed(2), toleranceTDown: target.toleranceTDown.toFixed(2),
      toleranceAUp: target.toleranceAUp.toFixed(2), toleranceADown: target.toleranceADown.toFixed(2),
      toleranceBUp: target.toleranceBUp.toFixed(2), toleranceBDown: target.toleranceBDown.toFixed(2),
      mentori4: target.mentori4.toFixed(1), mentori8: target.mentori8.toFixed(1),
    })
    const matName = materials.find(m => m.materialCode === target.materialCode)?.materialName ?? target.materialCode
    setMatSuggest(matName)
    setSpecSuggest(target.shiagari)
    setEditingDetailId(id)
    window.scrollTo({ top: 0, behavior: "smooth" })
    setTimeout(() => focusById("f-mat-suggest"), 50)
  }
  // ── 明細行 複写 ──
  // 一覧の行はそのまま残し、内容をフォームへコピーする（新規UUIDを振り直す）。
  // ユーザーは複写内容を必要に応じて変更し、再計算→「明細に追加」で
  // 別行として一覧に追加できる。
  const handleDuplicateDetail = (id: string) => {
    const target = details.find(d => d.clientDetailId === id)
    if (!target) return
    console.log("[handleDuplicateDetail] 複写対象:", JSON.stringify(target, null, 2))
    // 複写は常に新規追加扱い（編集モードではない）
    setEditingDetailId(null)
    setForm({ ...target, clientDetailId: generateUUID(), calculated: false })
    setTolInputs({
      toleranceTUp: target.toleranceTUp.toFixed(2), toleranceTDown: target.toleranceTDown.toFixed(2),
      toleranceAUp: target.toleranceAUp.toFixed(2), toleranceADown: target.toleranceADown.toFixed(2),
      toleranceBUp: target.toleranceBUp.toFixed(2), toleranceBDown: target.toleranceBDown.toFixed(2),
      mentori4: target.mentori4.toFixed(1), mentori8: target.mentori8.toFixed(1),
    })
    const matName = materials.find(m => m.materialCode === target.materialCode)?.materialName ?? target.materialCode
    setMatSuggest(matName)
    setSpecSuggest(target.shiagari)
    window.scrollTo({ top: 0, behavior: "smooth" })
    setTimeout(() => focusById("f-mat-suggest"), 50)
  }
  const handleDel = (id: string) => {
    console.log("[handleDel] 明細削除 id:", id)
    setDetails(p => p.filter(d => d.clientDetailId !== id))
    setSelectedIds(p => { const n = new Set(p); n.delete(id); return n })
  }
  const selAll = (v: boolean) => {
    console.log("[selAll] 全選択:", v)
    setSelectedIds(v ? new Set(details.map(d => d.clientDetailId)) : new Set())
  }
  const selOne = (id: string, v: boolean) => {
    console.log("[selOne] 個別選択 id:", id, "checked:", v)
    setSelectedIds(p => { const n = new Set(p); v ? n.add(id) : n.delete(id); return n })
  }

  // ── 保存 ──
  const handleSave = async () => {
    // 送り先マスタ登録/更新チェック
    const distOk = await checkAndSaveDistMaster()
    if (!distOk) return
    const isHikitori = shippingMethod === "引取り"
    // APIはbody直下のフラット構造で inputDate, details 等を参照する
    const payload = {
      inputDate,
      estimateDate,
      shippingMethodId: shippingMethod === "発送" ? 1 : shippingMethod === "直送" ? 2 : 3,
      customerOrderNo: custOrderNo,
      endUserNo,
      remarks: contact,
      contact,
      destinationCode:    isHikitori ? "" : distCode,
      destinationName:    isHikitori ? "" : distName,
      destinationDept:    isHikitori ? "" : distDept,
      destinationPerson:  isHikitori ? "" : distPerson,
      destinationZip:     isHikitori ? "" : distZip,
      destinationAddress: isHikitori ? "" : distAddr,
      destinationTel:     isHikitori ? "" : distTel,
      destinationFax:     isHikitori ? "" : distFax,
      details: details.map((d, i) => ({ ...d, rowNo: i + 1,
        mentoriShiji: String(d.mentoriShiji),
        kakouShiyou: d.shiagari,
        kakouT: d.kakouShijiCodeT, kakouA: d.kakouShijiCodeA, kakouB: d.kakouShijiCodeB,
      })),
    }
    console.log("[handleSave] リクエスト:", JSON.stringify(payload, null, 2))
    setSaving(true); setSaveMsg("保存中...")
    try {
      const isEdit = !!draftId
      const fetchUrl = isEdit ? `/api/v1/estimates/${draftId}` : "/api/v1/estimates"
      const fetchMethod = isEdit ? "PUT" : "POST"
      console.log(`[handleSave] ${isEdit ? "編集更新(PUT)" : "新規保存(POST)"} url:`, fetchUrl)
      const res = await fetch(fetchUrl, {
        method: fetchMethod, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      console.log("[handleSave] レスポンス:", JSON.stringify(data, null, 2))
      if (!res.ok) throw new Error(data.error ?? "保存失敗")
      const savedId = data.estimateId ?? data.id
      const savedNo = data.estimateNo ?? estimateNo
      if (savedId) setDraftId(savedId)
      setEstimateNo(savedNo)
      setSaveMsg("✅ 保存完了！見積番号: " + savedNo)
    } catch (e: any) {
      console.error("[handleSave] エラー:", e.message)
      setSaveMsg("❌ 保存失敗: " + e.message)
    }
    finally { setSaving(false); setTimeout(() => setSaveMsg(""), 4000) }
  }

  const handleOrder = async () => {
    const sel = details.filter(d => selectedIds.has(d.clientDetailId))
    console.log("[handleOrder] 選択明細:", sel.length, "件")
    if (sel.length === 0) { alert("注文する明細を選択してください"); return }
    // パターン3のみ注文可能チェック
    const nonOrderable = sel.filter(d => detailPattern(d) !== 3)
    if (nonOrderable.length > 0) { alert("注文できない明細が含まれています。\n金額・納期が両方算出された明細のみ注文できます。"); return }
    await handleSave()
    if (draftId) window.location.href = "/orders/confirm?estimateId=" + draftId
  }

  // ── 直送先：フィールドセット共通ヘルパー ──
  const applyDelivery = (dd: any) => {
    setDistId(dd.id ?? null)
    setDistCode(dd.deliveryCode ?? dd.code ?? "")
    setDistName(dd.companyName ?? dd.name ?? "")
    setDistDept(dd.departmentName ?? dd.department ?? "")
    setDistPerson(dd.contactPerson ?? dd.person ?? "")
    setDistZip(dd.postalCode ?? dd.zipCode ?? "")
    setDistAddr([dd.address1, dd.address2, dd.address3].filter(Boolean).join("") || dd.address || "")
    setDistTel(dd.phoneNumber ?? dd.tel ?? "")
    setDistFax(dd.faxNumber ?? dd.fax ?? "")
    // 呼び出し時スナップショット保存（変更検知用）
    setDistOriginal({
      name: dd.companyName ?? dd.name ?? "",
      dept: dd.departmentName ?? dd.department ?? "",
      person: dd.contactPerson ?? dd.person ?? "",
      zip: dd.postalCode ?? dd.zipCode ?? "",
      addr: [dd.address1, dd.address2, dd.address3].filter(Boolean).join("") || dd.address || "",
      tel: dd.phoneNumber ?? dd.tel ?? "",
      fax: dd.faxNumber ?? dd.fax ?? "",
    })
  }

  // ── 直送先コード照会（コード入力→ENTER / 🔍ボタン） ──
  const handleDistSearch = async () => {
    console.log("[handleDistSearch] distCode:", distCode)
    if (!distCode.trim()) {
      // コードが空 → モーダルを開く
      setShowDistModal(true)
      return
    }
    try {
      const url = `/api/v1/masters/direct-delivery/search?code=${encodeURIComponent(distCode.trim())}`
      const res = await fetch(url)
      const d = await res.json()
      console.log("[handleDistSearch] レスポンス:", JSON.stringify(d, null, 2))
      if (d.delivery) {
        applyDelivery(d.delivery)
        setTimeout(() => focusById("f-contact"), 50)
      } else {
        alert(`出荷先コード「${distCode}」はマスタに存在しません。
出荷先名を直接入力してください。`)
        setDistId(null)
        setDistOriginal(null)
        setTimeout(() => focusById("f-distName"), 50)
      }
    } catch(e: any) { console.error("[handleDistSearch] エラー:", e.message) }
  }

  // ── モーダル内キーワード検索 ──
  const handleDistModalSearch = async (kw: string) => {
    try {
      const url = `/api/v1/masters/direct-delivery/search?keyword=${encodeURIComponent(kw)}`
      const res = await fetch(url)
      const d = await res.json()
      setDistModalRows(d.deliveries ?? [])
    } catch(e: any) { console.error("[handleDistModalSearch] エラー:", e.message) }
  }

  // ── モーダルで行選択 ──
  const handleDistModalSelect = (row: any) => {
    applyDelivery(row)
    setShowDistModal(false)
    setDistModalKw("")
    setDistModalRows([])
    setTimeout(() => focusById("f-contact"), 50)
  }

  // ── 送り先マスタ登録/更新チェック（保存・注文前に呼ぶ） ──
  const checkAndSaveDistMaster = async (): Promise<boolean> => {
    if (shippingMethod === "引取り") return true  // 引取りは送り先マスタ処理スキップ
    const hasDistInfo = distName.trim() !== ""
    if (!hasDistInfo) return true  // 送り先情報なし → スキップ

    if (!distId) {
      // コードなし・直接入力 → 新規登録確認
      const ok = window.confirm(
        `【送り先マスタ登録】\n入力された送り先情報をマスタに登録しますか？\n\n出荷先名: ${distName}\n住所: ${distAddr}\nTEL: ${distTel}\n\n「はい」で登録、「いいえ」でスキップ`
      )
      if (!ok) return true  // キャンセル → 登録しないが保存は続行
      try {
        const body = {
          deliveryCode: distCode.trim() || "",
          companyName: distName,
          departmentName: distDept || null,
          contactPerson: distPerson || null,
          postalCode: distZip || null,
          address1: distAddr || null,
          phoneNumber: distTel || null,
          faxNumber: distFax || null,
        }
        const res = await fetch("/api/v1/masters/direct-delivery", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) {
          alert("送り先マスタ登録に失敗しました: " + (data.error ?? "不明なエラー"))
          return false
        }
        setDistId(data.id)
        if (data.deliveryCode) setDistCode(data.deliveryCode)
        setDistOriginal({ name: distName, dept: distDept, person: distPerson, zip: distZip, addr: distAddr, tel: distTel, fax: distFax })
        console.log("[checkAndSaveDistMaster] 新規登録完了:", data.id)
      } catch(e: any) {
        alert("送り先マスタ登録中にエラーが発生しました: " + e.message)
        return false
      }
    } else if (distOriginal && distId && distId !== "__existing__") {
      const changed =
        distName    !== distOriginal.name   ||
        distDept    !== distOriginal.dept   ||
        distPerson  !== distOriginal.person ||
        distZip     !== distOriginal.zip    ||
        distAddr    !== distOriginal.addr   ||
        distTel     !== distOriginal.tel    ||
        distFax     !== distOriginal.fax
      if (changed) {
        const ok = window.confirm(
          `【送り先マスタ更新】\n変更された送り先情報でマスタを更新しますか？\n\n出荷先名: ${distName}\n住所: ${distAddr}\nTEL: ${distTel}\n\n「はい」で更新、「いいえ」でスキップ`
        )
        if (!ok) return true
        try {
          const body = {
            companyName: distName,
            departmentName: distDept || null,
            contactPerson: distPerson || null,
            postalCode: distZip || null,
            address1: distAddr || null,
            phoneNumber: distTel || null,
            faxNumber: distFax || null,
          }
          const res = await fetch(`/api/v1/masters/direct-delivery/${distId}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
          const data = await res.json()
          if (!res.ok) {
            alert("送り先マスタ更新に失敗しました: " + (data.error ?? "不明なエラー"))
            return false
          }
          setDistOriginal({ name: distName, dept: distDept, person: distPerson, zip: distZip, addr: distAddr, tel: distTel, fax: distFax })
          console.log("[checkAndSaveDistMaster] 更新完了:", distId)
        } catch(e: any) {
          alert("送り先マスタ更新中にエラーが発生しました: " + e.message)
          return false
        }
      }
    }
    return true
  }

  // ── 郵便番号検索（バグ修正：address1+address2+address3を連結） ──
  const handleZip = async () => {
    const digits = zipDigits(distZip)
    console.log("[handleZip] 入力:", distZip, "→ digits:", digits)
    if (digits.length < 7) {
      // 7桁未満なら0補完して整形のみ
      const formatted = normalizeZip(distZip)
      setDistZip(formatted)
      console.log("[handleZip] 桁不足のため整形のみ:", formatted)
      return
    }
    const zipFormatted = normalizeZip(distZip)
    setDistZip(zipFormatted)
    try {
      const url = `/api/v1/postal-code?zip=${digits}`
      console.log("[handleZip] APIリクエスト URL:", url)
      const res = await fetch(url)
      const d = await res.json()
      console.log("[handleZip] APIレスポンス:", JSON.stringify(d, null, 2))
      if (!res.ok) throw new Error(d.error ?? "住所取得失敗")
      // ★ バグ修正: d.addressではなくd.address1+d.address2+d.address3を連結
      const address = [d.address1, d.address2, d.address3].filter(Boolean).join("")
      console.log("[handleZip] 住所設定:", address)
      setDistAddr(address)
      // 住所欄の末尾にカーソル
      setTimeout(() => {
        const el = document.getElementById("f-distAddr") as HTMLInputElement | null
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length) }
      }, 50)
    } catch(e: any) { console.error("[handleZip] エラー:", e.message) }
  }

  return (
    <div style={{ fontSize: "13px", padding: "4px 8px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* ─── ヘッダーボタン ─── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
        <div style={{ fontWeight: 700, fontSize: "15px", color: "#1e3a5f" }}>お見積り入力</div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button className="btn-ochi btn-outline" style={{ fontSize: "13px" }}
            onClick={() => { console.log("[新規] フォームリセット"); setForm(newForm()); setMatSuggest(""); setSpecSuggest(""); setEditingDetailId(null) }}>新規</button>
          <button className="btn-ochi btn-navy" style={{ fontSize: "13px" }}
            onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "💾 この見積りを保存"}</button>
          <button className="btn-ochi btn-amber" style={{ fontSize: "13px" }}
            onClick={handleOrder}>📋 この見積りを注文</button>
          <Link href="/dashboard">
            <button className="btn-ochi btn-outline" style={{ fontSize: "13px" }}>← メインメニュー</button>
          </Link>
        </div>
      </div>

      {saveMsg && (
        <div style={{ background: saveMsg.startsWith("✅") ? "#f0fdf4" : "#fee2e2", border: "1px solid " + (saveMsg.startsWith("✅") ? "#86efac" : "#fca5a5"), borderRadius: "4px", padding: "4px 10px", fontSize: "11px", marginBottom: "6px" }}>
          {saveMsg}
        </div>
      )}

      {/* ─── ヘッダーテーブル ─── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "0", fontSize: "11px" }}>
        <tbody>
          <tr>
            <td style={LBL}>見積No</td>
            <td style={{ ...TD, width: "130px" }}><input style={{ ...INP, background: "#f8fafc", color: "#94a3b8" }} value={estimateNo} readOnly /></td>
            <td style={LBL}>注文No</td>
            <td style={{ ...TD, width: "130px" }}>
              <input id="f-orderNo" style={INP} value={orderNo}
                onChange={e => { console.log("[注文No] →", e.target.value); setOrderNo(e.target.value) }}
                onKeyDown={onEnter("f-inputDate")} {...FH} /></td>
            <td style={LBL}>入力日付</td>
            <td style={{ ...TD, width: "120px" }}>
              <input id="f-inputDate" style={INP} type="date" value={inputDate}
                onChange={e => { console.log("[入力日付] →", e.target.value); setInputDate(e.target.value) }}
                onKeyDown={onEnter("f-estDate")} {...FH} /></td>
            <td style={LBL}>見積日付</td>
            <td style={{ ...TD, width: "120px" }}>
              <input id="f-estDate" style={INP} type="date" value={estimateDate}
                onChange={e => { console.log("[見積日付] →", e.target.value); setEstimateDate(e.target.value) }}
                onKeyDown={onEnter("f-shippingMethod")} {...FH} /></td>
          </tr>
          <tr>
            <td style={LBL}>お客様名</td>
            <td colSpan={3} style={TD}><input style={{ ...INP, background: "#f8fafc", color: "#64748b" }} value={userInfo.companyName} readOnly /></td>
            <td style={LBL}>ご担当者</td>
            <td colSpan={3} style={TD}><input style={{ ...INP, background: "#f8fafc", color: "#64748b" }} value={userInfo.userName} readOnly /></td>
          </tr>
        </tbody>
      </table>

      {/* ─── 発送方法 ─── */}
      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderTop: "none", padding: "3px 10px", display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#374151" }}>発送方法</span>
        <select id="f-shippingMethod" style={{ ...SEL, width: "100px" }} value={shippingMethod}
          onChange={e => { console.log("[発送方法] →", e.target.value); setShippingMethod(e.target.value) }}
          onKeyDown={onEnter("f-distCode")} {...FH}>
          <option value="発送">発送</option><option value="直送">直送</option><option value="引取り">引取り</option>
        </select>
        <span style={{ fontSize: "10px", color: "#94a3b8" }}>リストよりお選びください</span>
      </div>

      {/* ─── 送り先情報 ─── */}
      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 4px 4px", padding: "6px 10px", opacity: shippingMethod === "引取り" ? 0.45 : 1, pointerEvents: shippingMethod === "引取り" ? "none" : undefined }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#1e3a5f", marginBottom: "5px" }}>送り先情報{shippingMethod === "引取り" && <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 400, marginLeft: "8px" }}>（引取りのため入力不可）</span>}</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr", gap: "4px 8px", alignItems: "end", marginBottom: "4px" }}>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>出荷先</div>
            <div style={{ display: "flex", gap: "3px" }}>
              <input id="f-distCode" style={{ ...INP, width: "70px" }} value={distCode}
                onChange={e => { console.log("[出荷先コード] →", e.target.value); setDistCode(e.target.value); setDistId(null); setDistOriginal(null) }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleDistSearch() } }} {...FH} />
              <button className="btn-ochi btn-outline" style={{ fontSize: "10px", padding: "1px 6px", height: "24px" }}
                title="出荷先を検索"
                onClick={() => { setShowDistModal(true); setDistModalKw(""); setTimeout(() => handleDistModalSearch(""), 0) }}>🔍</button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>出荷先名</div>
            <input id="f-distName" style={INP} value={distName}
              onChange={e => { console.log("[出荷先名] →", e.target.value); setDistName(e.target.value) }}
              onKeyDown={onEnter("f-distDept")} {...FH} />
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>出荷先部署</div>
            <input id="f-distDept" style={INP} value={distDept}
              onChange={e => { console.log("[出荷先部署] →", e.target.value); setDistDept(e.target.value) }}
              onKeyDown={onEnter("f-distPerson")} {...FH} />
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>ご担当者</div>
            <input id="f-distPerson" style={INP} value={distPerson}
              onChange={e => { console.log("[ご担当者] →", e.target.value); setDistPerson(e.target.value) }}
              onKeyDown={onEnter("f-distZip")} {...FH} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "170px 1fr 160px 160px", gap: "4px 8px", marginBottom: "4px" }}>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>〒 （7桁数字、ENTERで住所検索）</div>
            <div style={{ display: "flex", gap: "3px" }}>
              <input id="f-distZip" style={{ ...INP, flex: 1 }} value={distZip}
                onChange={e => {
                  // 数字・ハイフンのみ許可
                  const v = e.target.value.replace(/[^\d-]/g, "")
                  console.log("[郵便番号] 入力:", v)
                  setDistZip(v)
                }}
                onBlur={e => {
                  // フォーカスを外したとき整形
                  const formatted = normalizeZip(e.target.value)
                  if (formatted) { setDistZip(formatted); console.log("[郵便番号] onBlur整形:", formatted) }
                }}
                onFocus={e => { e.target.style.background = "#ffffcc"; e.target.style.borderColor = "#f59e0b" }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleZip().then(() => focusById("f-distAddr")) } }}
                placeholder="xxx-xxxx" />
              <button className="btn-ochi btn-outline" style={{ fontSize: "9px", padding: "0 4px", height: "24px" }}
                onClick={() => handleZip().then(() => focusById("f-distAddr"))}>検索</button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>住所</div>
            <input id="f-distAddr" style={INP} value={distAddr}
              onChange={e => { console.log("[住所] →", e.target.value); setDistAddr(e.target.value) }}
              onKeyDown={onEnter("f-distTel")} {...FH} />
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>TEL</div>
            <input id="f-distTel" style={INP} value={distTel}
              onChange={e => { console.log("[TEL] →", e.target.value); setDistTel(e.target.value) }}
              onKeyDown={onEnter("f-distFax")} {...FH} />
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>FAX</div>
            <input id="f-distFax" style={INP} value={distFax}
              onChange={e => { console.log("[FAX] →", e.target.value); setDistFax(e.target.value) }}
              onKeyDown={onEnter("f-contact")} {...FH} />
          </div>
        </div>
        <div style={{ pointerEvents: "auto", opacity: 1 }}>
          <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>通信欄</div>
          <input id="f-contact" style={{ ...INP, pointerEvents: "auto", opacity: 1 }} value={contact}
            onChange={e => { console.log("[通信欄] →", e.target.value); setContact(e.target.value) }}
            onKeyDown={onEnter("f-mat-suggest")} {...FH} />
        </div>
      </div>

      {/* ─── 出荷先検索モーダル ─── */}
      {showDistModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "8px", boxShadow: "0 8px 32px rgba(0,0,0,0.25)", width: "640px", maxWidth: "95vw", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div style={{ background: "#1e3a5f", color: "#fff", padding: "10px 16px", borderRadius: "8px 8px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: "14px" }}>🔍 出荷先検索</span>
              <button onClick={() => { setShowDistModal(false); setDistModalKw(""); setDistModalRows([]) }}
                style={{ background: "none", border: "none", color: "#fff", fontSize: "18px", cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: "8px" }}>
              <input autoFocus style={{ ...INP, flex: 1 }} placeholder="コード・社名・部署・担当者で検索"
                value={distModalKw} onChange={e => setDistModalKw(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleDistModalSearch(distModalKw) } }} {...FH} />
              <button className="btn-ochi btn-blue" style={{ fontSize: "13px" }} onClick={() => handleDistModalSearch(distModalKw)}>検索</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {distModalRows.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                  {distModalKw ? "該当する出荷先が見つかりません" : "キーワードを入力して検索してください"}
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead><tr>
                    {["コード","出荷先名","部署","担当者","郵便番号","住所"].map(h => (
                      <th key={h} style={{ background: "#1e3a5f", color: "#fff", padding: "6px 8px", textAlign: "left", whiteSpace: "nowrap", position: "sticky", top: 0 }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {distModalRows.map((row, i) => (
                      <tr key={row.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc", cursor: "pointer" }}
                        onClick={() => handleDistModalSelect(row)}
                        onMouseEnter={e => (e.currentTarget.style.background = "#dbeafe")}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#f8fafc")}>
                        <td style={{ padding: "6px 8px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{row.deliveryCode}</td>
                        <td style={{ padding: "6px 8px", borderBottom: "1px solid #e2e8f0" }}>{row.companyName}</td>
                        <td style={{ padding: "6px 8px", borderBottom: "1px solid #e2e8f0" }}>{row.departmentName ?? ""}</td>
                        <td style={{ padding: "6px 8px", borderBottom: "1px solid #e2e8f0" }}>{row.contactPerson ?? ""}</td>
                        <td style={{ padding: "6px 8px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{row.postalCode ?? ""}</td>
                        <td style={{ padding: "6px 8px", borderBottom: "1px solid #e2e8f0" }}>{[row.address1, row.address2, row.address3].filter(Boolean).join("")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ padding: "8px 16px", borderTop: "1px solid #e2e8f0", textAlign: "right" }}>
              <button className="btn-ochi btn-outline" style={{ fontSize: "13px" }}
                onClick={() => { setShowDistModal(false); setDistModalKw(""); setDistModalRows([]) }}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 見積明細編集 ─── */}
      <div style={{ fontSize: "11px", fontWeight: 600, background: editingDetailId ? "#fef3c7" : "#d8e9f5", color: editingDetailId ? "#92400e" : "#1e3a5f", padding: "3px 8px", borderRadius: "4px 4px 0 0", marginTop: "8px" }}>
        見積明細編集
        {editingDetailId && (() => {
          const idx = details.findIndex(d => d.clientDetailId === editingDetailId)
          return idx >= 0 ? ` — No.${idx + 1} を編集中` : null
        })()}
      </div>
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0" }}>
        <datalist id="dl-materials">
          {materials.map(m => <option key={m.materialCode} value={m.materialName || m.materialCode} />)}
        </datalist>
        <datalist id="dl-specs">
          {filteredSpecs.map(s => <option key={s.processingSpecCode} value={s.processingSpecName} />)}
        </datalist>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "32px" }} /><col style={{ width: "90px" }} /><col style={{ width: "90px" }} />
            <col style={{ width: "40px" }} /><col style={{ width: "40px" }} /><col style={{ width: "40px" }} />
            <col style={{ width: "58px" }} /><col style={{ width: "62px" }} /><col style={{ width: "66px" }} />
            <col style={{ width: "40px" }} /><col style={{ width: "44px" }} /><col style={{ width: "44px" }} /><col style={{ width: "44px" }} />
            <col style={{ width: "66px" }} /><col style={{ width: "40px" }} /><col style={{ width: "40px" }} />
            <col style={{ width: "42px" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={TH} rowSpan={2}>No</th>
              <th style={TH} rowSpan={2}>材料</th>
              <th style={TH} rowSpan={2}>仕上り</th>
              <th style={TH} colSpan={3}>加工仕様</th>
              <th style={TH} colSpan={3}>寸法</th>
              <th style={TH} colSpan={4}>公差</th>
              <th style={TH} colSpan={3}>面取り</th>
              <th style={TH} rowSpan={2}>数量</th>
            </tr>
            <tr>
              <th style={TH}>厚み</th><th style={TH}>巾</th><th style={TH}>長さ</th>
              <th style={TH}>厚み</th><th style={TH}>巾</th><th style={TH}>長さ</th>
              <th style={TH}>標準</th><th style={TH}>厚み</th><th style={TH}>巾</th><th style={TH}>長さ</th>
              <th style={TH}>面取図</th><th style={TH}>4角</th><th style={TH}>8辺</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...TD, textAlign: "center", color: editingDetailId ? "#92400e" : "#94a3b8", fontSize: "10px", fontWeight: editingDetailId ? 700 : 400, background: editingDetailId ? "#fef3c7" : "transparent" }}>
                {editingDetailId
                  ? (() => {
                      const idx = details.findIndex(d => d.clientDetailId === editingDetailId)
                      return idx >= 0 ? idx + 1 : "—"
                    })()
                  : "—"}
              </td>

              {/* 材料: サジェスト */}
              <td style={TD}>
                <input id="f-mat-suggest" ref={matInputRef} list="dl-materials" style={SEL}
                  value={matSuggest}
                  onChange={e => {
                    const v = e.target.value; setMatSuggest(v)
                    const hit = materials.find(m => normalizeForMatch(m.materialName) === normalizeForMatch(v) || normalizeForMatch(m.materialCode) === normalizeForMatch(v))
                    if (hit) handleMaterialSelect(hit.materialCode)
                  }}
                  onKeyDown={e => {
                    if (e.key !== "Enter") return; e.preventDefault()
                    const hit = materials.find(m => normalizeForMatch(m.materialName) === normalizeForMatch(matSuggest) || normalizeForMatch(m.materialCode) === normalizeForMatch(matSuggest))
                    if (hit) handleMaterialSelect(hit.materialCode)
                    else focusById("f-shiagari")
                  }}
                  placeholder="材料名入力" {...FH} />
              </td>

              {/* 仕上り: サジェスト + DBのkakou_shiji列で加工指示自動設定 */}
              <td style={TD}>
                <input id="f-shiagari" list="dl-specs" style={SEL}
                  value={specSuggest}
                  onChange={e => {
                    const v = e.target.value; setSpecSuggest(v)
                    const hit = filteredSpecs.find(s => normalizeForMatch(s.processingSpecName) === normalizeForMatch(v))
                    if (hit) handleSpecSelect(hit, false)
                  }}
                  onKeyDown={e => {
                    if (e.key !== "Enter") return; e.preventDefault()
                    const hit = filteredSpecs.find(s => normalizeForMatch(s.processingSpecName) === normalizeForMatch(specSuggest))
                    if (hit) {
                      handleSpecSelect(hit, false)
                      const defined = allCutsDefined(hit.kakouShijiT || "W", hit.kakouShijiA || "W", hit.kakouShijiB || "W")
                      console.log(`[仕上りENTER] spec:${hit.processingSpecName} 全面確定:${defined}`)
                      if (defined) setTimeout(() => focusById("f-sizeT"), 50)
                      else setTimeout(() => focusById("f-cutT"), 50)
                    } else { focusById("f-cutT") }
                  }}
                  placeholder="仕上り選択" {...FH} />
              </td>

              {/* 加工仕様: 厚み/巾/長さ */}
              <td style={TD}>
                <select id="f-cutT" style={SEL} value={form.kakouShijiCodeT}
                  onChange={e => { console.log("[加工仕様T] →", e.target.value); setForm(f => ({ ...f, kakouShijiCodeT: e.target.value })) }}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); focusById("f-cutA") } }} {...FH}>
                  <option value="W">W</option><option value="G">G</option>
                  <option value="〜">〜</option><option value="RG">RG</option><option value="SG">SG</option>
                </select>
              </td>
              <td style={TD}>
                <select id="f-cutA" style={SEL} value={form.kakouShijiCodeA}
                  onChange={e => { console.log("[加工仕様A] →", e.target.value); setForm(f => ({ ...f, kakouShijiCodeA: e.target.value })) }}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); focusById("f-cutB") } }} {...FH}>
                  <option value="W">W</option><option value="G">G</option>
                  <option value="〜">〜</option><option value="RG">RG</option><option value="SG">SG</option>
                </select>
              </td>
              <td style={TD}>
                <select id="f-cutB" style={SEL} value={form.kakouShijiCodeB}
                  onChange={e => { console.log("[加工仕様B] →", e.target.value); setForm(f => ({ ...f, kakouShijiCodeB: e.target.value })) }}
                  onKeyDown={onEnter("f-sizeT")} {...FH}>
                  <option value="W">W</option><option value="G">G</option>
                  <option value="〜">〜</option><option value="RG">RG</option><option value="SG">SG</option>
                </select>
              </td>

              {/* 寸法 */}
              <td style={TD}>
                <input id="f-sizeT" style={{ ...INP, textAlign: "right" }} type="number" step="0.001"
                  value={form.sizeT || ""}
                  onChange={e => { const v = parseFloat(e.target.value)||0; console.log("[寸法T] →", v); setForm(f => ({ ...f, sizeT: v, calculated: false })) }}
                  onKeyDown={onEnter("f-sizeA")} {...FH} />
              </td>
              <td style={TD}>
                <input id="f-sizeA" style={{ ...INP, textAlign: "right" }} type="number" step="0.001"
                  value={form.sizeA || ""}
                  onChange={e => { const v = parseFloat(e.target.value)||0; console.log("[寸法A(巾)] →", v); setForm(f => ({ ...f, sizeA: v })) }}
                  onKeyDown={onEnter("f-sizeB")} {...FH} />
              </td>
              <td style={TD}>
                <input id="f-sizeB" style={{ ...INP, textAlign: "right" }} type="number" step="0.001"
                  value={form.sizeB || ""}
                  onChange={e => { const v = parseFloat(e.target.value)||0; console.log("[寸法B(長さ)] →", v); setForm(f => ({ ...f, sizeB: v })) }}
                  onKeyDown={onEnter("btn-std-tol")} {...FH} />
              </td>

              {/* 標準公差ボタン */}
              <td style={{ ...TD, textAlign: "center", padding: "2px" }}>
                <button id="btn-std-tol" className="btn-ochi btn-outline"
                  style={{ fontSize: "12px", fontWeight: 700, padding: "3px 5px", width: "100%", height: "28px" }}
                  onClick={handleStdTol}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleStdTol() } }}>標準</button>
              </td>

              {/* 公差: 上下2段 */}
              <td style={{ ...TD, padding: "1px 2px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <input id="f-tolTUp" style={TOL_INP} type="text" inputMode="decimal"
                    value={tolInputs.toleranceTUp}
                    onChange={e => { console.log("[公差T上]→", e.target.value); makeTolHandler("toleranceTUp")(e) }}
                    onBlur={e => { FH.onBlur(e); makeTolBlur("toleranceTUp")() }}
                    onKeyDown={onEnter("f-tolTDn")} onFocus={FH.onFocus} />
                  <input id="f-tolTDn" style={TOL_INP} type="text" inputMode="decimal"
                    value={tolInputs.toleranceTDown}
                    onChange={e => { console.log("[公差T下]→", e.target.value); makeTolHandler("toleranceTDown")(e) }}
                    onBlur={e => { FH.onBlur(e); makeTolBlur("toleranceTDown")() }}
                    onKeyDown={onEnter("f-tolAUp")} onFocus={FH.onFocus} />
                </div>
              </td>
              <td style={{ ...TD, padding: "1px 2px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <input id="f-tolAUp" style={TOL_INP} type="text" inputMode="decimal"
                    value={tolInputs.toleranceAUp}
                    onChange={e => { console.log("[公差A上]→", e.target.value); makeTolHandler("toleranceAUp")(e) }}
                    onBlur={e => { FH.onBlur(e); makeTolBlur("toleranceAUp")() }}
                    onKeyDown={onEnter("f-tolADn")} onFocus={FH.onFocus} />
                  <input id="f-tolADn" style={TOL_INP} type="text" inputMode="decimal"
                    value={tolInputs.toleranceADown}
                    onChange={e => { console.log("[公差A下]→", e.target.value); makeTolHandler("toleranceADown")(e) }}
                    onBlur={e => { FH.onBlur(e); makeTolBlur("toleranceADown")() }}
                    onKeyDown={onEnter("f-tolBUp")} onFocus={FH.onFocus} />
                </div>
              </td>
              <td style={{ ...TD, padding: "1px 2px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <input id="f-tolBUp" style={TOL_INP} type="text" inputMode="decimal"
                    value={tolInputs.toleranceBUp}
                    onChange={e => { console.log("[公差B上]→", e.target.value); makeTolHandler("toleranceBUp")(e) }}
                    onBlur={e => { FH.onBlur(e); makeTolBlur("toleranceBUp")() }}
                    onKeyDown={onEnter("f-tolBDn")} onFocus={FH.onFocus} />
                  <input id="f-tolBDn" style={TOL_INP} type="text" inputMode="decimal"
                    value={tolInputs.toleranceBDown}
                    onChange={e => { console.log("[公差B下]→", e.target.value); makeTolHandler("toleranceBDown")(e) }}
                    onBlur={e => { FH.onBlur(e); makeTolBlur("toleranceBDown")() }}
                    onKeyDown={onEnter("btn-std-chamfer")} onFocus={FH.onFocus} />
                </div>
              </td>

              {/* 面取り */}
              <td style={{ ...TD, textAlign: "center", padding: "2px 3px" }}>
                <select style={{ ...SEL, fontSize: "9px", height: "22px", marginBottom: "2px" }}
                  value={form.mentoriShiji}
                  onChange={e => { console.log("[面取図]→",e.target.value); setForm(f => ({ ...f, mentoriShiji: parseInt(e.target.value) })) }} {...FH}>
                  <option value={1}>面取図参照</option>
                  <option value={2}>面取不可</option>
                  <option value={9}>---</option>
                </select>
                <button id="btn-std-chamfer" className="btn-ochi btn-outline"
                  style={{ fontSize: "11px", fontWeight: 700, padding: "1px 3px", display: "block", width: "100%", height: "24px" }}
                  onClick={handleStdChamfer}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleStdChamfer() } }}>標準</button>
              </td>
              <td style={TD}>
                <input id="f-mentori4" style={{ ...INP, textAlign: "right" }} type="text" inputMode="decimal"
                  value={tolInputs.mentori4}
                  onChange={e => { console.log("[4C]→", e.target.value); makeTolHandler("mentori4")(e) }}
                  onBlur={e => { FH.onBlur(e); makeTolBlur("mentori4")() }}
                  onKeyDown={onEnter("f-mentori8")} onFocus={FH.onFocus} />
              </td>
              <td style={TD}>
                <input id="f-mentori8" style={{ ...INP, textAlign: "right" }} type="text" inputMode="decimal"
                  value={tolInputs.mentori8}
                  onChange={e => { console.log("[8C]→", e.target.value); makeTolHandler("mentori8")(e) }}
                  onBlur={e => { FH.onBlur(e); makeTolBlur("mentori8")() }}
                  onKeyDown={onEnter("f-qty")} onFocus={FH.onFocus} />
              </td>
              <td style={TD}>
                <input id="f-qty" style={{ ...INP, textAlign: "right" }} type="number" min="1"
                  value={form.quantity}
                  onChange={e => { const v=parseInt(e.target.value)||1; console.log("[数量]→",v); setForm(f=>({...f,quantity:v})) }}
                  onKeyDown={onEnter("f-custDetailNo")} {...FH} />
              </td>
            </tr>

            {/* 注文番号・備考 */}
            <tr>
              <td colSpan={17} style={TD}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: "180px" }}>
                    <span style={{ fontSize: "9px", color: "#64748b" }}>お客様注文番号</span>
                    <input id="f-custDetailNo" style={INP} value={form.customerDetailOrderNo}
                      onChange={e => { console.log("[客注文番号]→",e.target.value); setForm(f => ({ ...f, customerDetailOrderNo: e.target.value })) }}
                      onKeyDown={onEnter("f-destDetailNo")} {...FH} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: "180px" }}>
                    <span style={{ fontSize: "9px", color: "#64748b" }}>送り先注文番号</span>
                    <input id="f-destDetailNo" style={INP} value={form.destinationDetailOrderNo}
                      onChange={e => { console.log("[送先注文番号]→",e.target.value); setForm(f => ({ ...f, destinationDetailOrderNo: e.target.value })) }}
                      onKeyDown={onEnter("f-remarks")} {...FH} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1px", flex: 1 }}>
                    <span style={{ fontSize: "9px", color: "#64748b" }}>備考</span>
                    <input id="f-remarks" style={INP} value={form.remarks}
                      onChange={e => { console.log("[備考]→",e.target.value); setForm(f => ({ ...f, remarks: e.target.value })) }}
                      onKeyDown={onEnter("btn-calc")} {...FH} />
                  </div>
                </div>
              </td>
            </tr>

            {/* 計算結果・ボタン */}
            <tr>
              <td colSpan={2} style={{ ...TD, padding: "4px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#334155" }}>最短納期</div>
                <input style={{ ...INP, background: "#eff6ff", border: "1.5px solid #93c5fd", color: "#1d4ed8", fontSize: "15px", fontWeight: 700 }} value={fmt(form.fastDeliveryDate)} readOnly />
              </td>
              <td colSpan={6} style={{ ...TD, padding: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#334155" }}>納期保証期限</div>
                    <input style={{ ...INP, width: "160px", fontSize: "14px", fontWeight: 700,
                      background: form.fastDeliveryDeadline ? "#fef9c3" : "#fff",
                      border: form.fastDeliveryDeadline ? "1.5px solid #f59e0b" : "1.5px solid #94a3b8",
                      color: form.fastDeliveryDeadline ? "#92400e" : "#0f172a" }} value={fmtDt(form.fastDeliveryDeadline)} readOnly />
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: 600, color: "#334155" }}>送料込みプレート単価</div>
                    <input style={{ ...INP, width: "95px", textAlign: "right", background: "#f8fafc", border: "1.5px solid #cbd5e1", color: "#0f172a", fontFamily: "monospace" }} value={form.unitPrice != null ? "¥" + form.unitPrice.toLocaleString() : ""} readOnly />
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: 600, color: "#334155" }}>送料込みプレート金額</div>
                    <input style={{ ...INP, width: "95px", textAlign: "right", background: "#f8fafc", border: "1.5px solid #cbd5e1", color: "#0f172a", fontFamily: "monospace" }} value={form.totalPrice != null ? "¥" + form.totalPrice.toLocaleString() : ""} readOnly />
                  </div>
                </div>
              </td>
              <td colSpan={9} style={{ ...TD, padding: "4px" }}>
                <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                  <button id="btn-calc" className="btn-ochi btn-blue"
                    style={{ fontSize: "13px", minWidth: "100px", opacity: calcLoading ? 0.6 : 1, cursor: calcLoading ? "not-allowed" : "pointer" }}
                    onClick={handleCalculate}
                    disabled={calcLoading}>
                    {calcLoading ? "⏳ 計算中..." : "📊 見積計算"}
                  </button>
                  <button id="btn-add" className="btn-ochi"
                    style={{ fontSize: "13px", minWidth: "110px", background: form.calculated ? (editingDetailId ? "#d97706" : "#16a34a") : "#94a3b8", color: "#fff", cursor: form.calculated ? "pointer" : "not-allowed", border: "none" }}
                    onClick={handleAdd} disabled={!form.calculated}>
                    {editingDetailId ? "✓ 明細を更新" : "＋ 明細に追加"}
                  </button>
                  <button className="btn-ochi btn-outline" style={{ fontSize: "13px" }}
                    onClick={() => { console.log("[クリア] フォームリセット"); setForm(newForm()); setMatSuggest(""); setSpecSuggest(""); setEditingDetailId(null); setTimeout(() => focusById("f-mat-suggest"), 50) }}>
                    クリア
                  </button>
                </div>
                {calcError && (
                  <div style={{ marginTop: "6px", padding: "8px 10px", background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: "4px", fontSize: "12px", color: "#991b1b", fontWeight: 600, textAlign: "left" }}>
                    ⚠ {calcError}
                  </div>
                )}
                {!form.calculated && (
                  <div style={{ fontSize: "9px", color: "#f59e0b", textAlign: "right", marginTop: "2px" }}>△ 先に「見積計算」を実行</div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ─── 登録済み明細 ─── */}
      <div style={{ marginTop: "8px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "4px 4px 0 0", padding: "3px 10px", display: "flex", gap: "12px", alignItems: "center" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#166534" }}>登録済み明細</span>
        <span style={{ fontSize: "11px", color: "#166534" }}>
          {details.length}件 / 合計 ¥{details.reduce((s, d) => s + (d.totalPrice ?? 0), 0).toLocaleString()}
        </span>
      </div>
      <div style={{ overflowX: "auto", border: "1px solid #86efac", borderTop: "none" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr>
              <th style={{ ...TH, background: "#166534", width: "60px" }}>
                <input type="checkbox"
                  onChange={e => selAll(e.target.checked)}
                  checked={details.filter(d => detailPattern(d) === 3 && !d.isOrdered).length > 0 && details.filter(d => detailPattern(d) === 3 && !d.isOrdered).every(d => selectedIds.has(d.clientDetailId))}
                  title="注文可能な明細をすべて選択" />
              </th>
              <th style={{ ...TH, background: "#166534", width: "28px" }}>No</th>
              <th style={{ ...TH, background: "#166534" }}>材料</th>
              <th style={{ ...TH, background: "#166534" }}>加工</th>
              <th style={{ ...TH, background: "#166534" }}>厚み</th>
              <th style={{ ...TH, background: "#166534" }}>巾</th>
              <th style={{ ...TH, background: "#166534" }}>長さ</th>
              <th style={{ ...TH, background: "#166534" }}>面取り</th>
              <th style={{ ...TH, background: "#166534" }}>数量</th>
              <th style={{ ...TH, background: "#166534" }}>納期</th>
              <th style={{ ...TH, background: "#166534" }}>納期保証期限</th>
              <th style={{ ...TH, background: "#166534" }}>ご注文番号</th>
              <th style={{ ...TH, background: "#166534" }}>単価</th>
              <th style={{ ...TH, background: "#166534" }}>金額</th>
              <th style={{ ...TH, background: "#166534" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {details.length === 0 ? (
              <tr><td colSpan={15} style={{ ...TD, textAlign: "center", padding: "12px", color: "#94a3b8" }}>明細がありません。上のフォームで入力後「明細に追加」してください。</td></tr>
            ) : details.map((d, i) => (
              <tr key={d.clientDetailId} style={{ background: d.isOrdered ? "#fefce8" : i % 2 === 0 ? "#fff" : "#f0fdf4" }}>
                <td style={{ ...TD, textAlign: "center", width: "60px" }}>
                  {d.isOrdered ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                      <span style={{ background: "#16a34a", color: "#fff", fontSize: "9px", fontWeight: 700, padding: "1px 5px", borderRadius: "9999px", whiteSpace: "nowrap" }}>注文済</span>
                      {d.orderedOrderNo && <span style={{ fontSize: "9px", color: "#166534", fontWeight: 600 }}>{d.orderedOrderNo}</span>}
                    </div>
                  ) : detailPattern(d) === 3 ? (
                    <input type="checkbox" checked={selectedIds.has(d.clientDetailId)} onChange={e => selOne(d.clientDetailId, e.target.checked)} title="注文可能" />
                  ) : (
                    <span title={detailPattern(d) === 1 ? "金額未算出のため注文不可" : "納期未回答のため注文不可"}
                      style={{ fontSize: "9px", color: "#94a3b8", cursor: "default" }}>
                      {detailPattern(d) === 1 ? "❶" : "❷"}
                    </span>
                  )}
                </td>
                <td style={{ ...TD, textAlign: "center" }}>{i + 1}</td>
                <td style={TD}>{materials.find(m => m.materialCode === d.materialCode)?.materialName ?? d.materialCode}</td>
                <td style={TD}>
                  <div style={{ fontWeight: 700 }}>{d.shiagari}</div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#334155", marginTop: "2px" }}>
                    T:{d.kakouShijiCodeT || "-"} A:{d.kakouShijiCodeA || "-"} B:{d.kakouShijiCodeB || "-"}
                  </div>
                </td>
                <td style={{ ...TD, textAlign: "right" }}>{d.sizeT}</td>
                <td style={{ ...TD, textAlign: "right" }}>{d.sizeA}</td>
                <td style={{ ...TD, textAlign: "right" }}>{d.sizeB}</td>
                <td style={{ ...TD, textAlign: "center" }}>{d.mentori4 ? `4C:${d.mentori4}` : ""}{d.mentori8 ? ` 8C:${d.mentori8}` : ""}</td>
                <td style={{ ...TD, textAlign: "right" }}>{d.quantity}</td>
                <td style={{ ...TD, textAlign: "center", color: isExpired(d.deliveryDeadline) ? "#ef4444" : "#374151" }}>
                  {fmt(d.fastDeliveryDate)}{isExpired(d.deliveryDeadline) && <span style={{ color: "#ef4444", fontSize: "9px" }}> ⚠期限切</span>}
                </td>
                <td style={{ ...TD, textAlign: "center" }}>
                  {d.deliveryDeadline ? (
                    <>
                      <div style={{ fontSize: "10px", color: isExpired(d.deliveryDeadline) ? "#ef4444" : "#334155", fontWeight: 600 }}>{fmtDt(d.deliveryDeadline)}</div>
                      <div style={{ fontSize: "9px", fontWeight: 700, color: remainingLabel(d.deliveryDeadline).color }}>{remainingLabel(d.deliveryDeadline).text}</div>
                    </>
                  ) : "—"}
                </td>
                <td style={TD}>{d.customerDetailOrderNo}</td>
                <td style={{ ...TD, textAlign: "right", fontFamily: "monospace" }}>{d.unitPrice != null ? "¥" + d.unitPrice.toLocaleString() : "—"}</td>
                <td style={{ ...TD, textAlign: "right", fontFamily: "monospace" }}>{d.totalPrice != null ? "¥" + d.totalPrice.toLocaleString() : "—"}</td>
                <td style={{ ...TD, textAlign: "center" }}>
                  <div style={{ display: "flex", gap: "4px", justifyContent: "center", flexWrap: "wrap" }}>
                    {!d.isOrdered && (
                      <>
                        <button className="btn-ochi btn-blue" style={{ fontSize: "11px", padding: "2px 8px", height: "26px" }} onClick={() => handleEditDetail(d.clientDetailId)}>✏️ 編集</button>
                        <button className="btn-ochi btn-gray" style={{ fontSize: "11px", padding: "2px 8px", height: "26px" }} onClick={() => handleDuplicateDetail(d.clientDetailId)}>📋 複写</button>
                        <button className="btn-ochi btn-red" style={{ fontSize: "11px", padding: "2px 8px", height: "26px" }} onClick={() => handleDel(d.clientDetailId)}>🗑️ 削除</button>
                      </>
                    )}
                    {d.isOrdered && (
                      <button className="btn-ochi btn-gray" style={{ fontSize: "11px", padding: "2px 8px", height: "26px" }} onClick={() => handleDuplicateDetail(d.clientDetailId)}>📋 複写</button>
                    )}
                    <button className="btn-ochi btn-outline" style={{ fontSize: "11px", padding: "2px 8px", height: "26px" }}
                      onClick={() => setHistoryModal({ id: d.clientDetailId, log: d.historyLog ?? [] })}
                      title="変更履歴">📋 履歴</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── 変更履歴モーダル ─── */}
      {historyModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "8px", boxShadow: "0 8px 32px rgba(0,0,0,0.25)", width: "600px", maxWidth: "95vw", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div style={{ background: "#1e3a5f", color: "#fff", padding: "10px 16px", borderRadius: "8px 8px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: "14px" }}>📋 明細変更履歴</span>
              <button onClick={() => setHistoryModal(null)} style={{ background: "none", border: "none", color: "#fff", fontSize: "18px", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
              {historyModal.log.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>履歴がありません</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr>
                      {["日時", "操作", "内容"].map(h => (
                        <th key={h} style={{ background: "#1e3a5f", color: "#fff", padding: "6px 10px", textAlign: "left", position: "sticky", top: 0 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...historyModal.log].reverse().map((log, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                        <td style={{ padding: "6px 10px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap", color: "#64748b" }}>
                          {new Date(log.at).toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </td>
                        <td style={{ padding: "6px 10px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
                          <span style={{ background: log.action === "新規追加" ? "#dcfce7" : log.action === "編集" ? "#dbeafe" : log.action === "注文" ? "#fef9c3" : "#f3f4f6", color: log.action === "新規追加" ? "#166534" : log.action === "編集" ? "#1e40af" : log.action === "注文" ? "#854d0e" : "#374151", fontSize: "11px", fontWeight: 600, padding: "1px 6px", borderRadius: "9999px" }}>{log.action}</span>
                        </td>
                        <td style={{ padding: "6px 10px", borderBottom: "1px solid #e2e8f0", color: "#374151" }}>{log.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ padding: "8px 16px", borderTop: "1px solid #e2e8f0", textAlign: "right" }}>
              <button className="btn-ochi btn-outline" style={{ fontSize: "13px" }} onClick={() => setHistoryModal(null)}>閉じる</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}