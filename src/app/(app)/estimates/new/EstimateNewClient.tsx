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

// ─── WO加工仕様マップ（添付SSのWO加工仕様テーブル実データ準拠） ──
// 加工指示コード: 1=RG, 2=W, 4=〜(なし/ランダム面), 5=SG
// ※ 6F2G等は複数の加工指示パターンが存在するため「デフォルト」のみ定義
//   実際の加工指示は仕上り選択後にユーザーが加工仕様欄で確認・変更する
const SHIAGARI_CUT_MAP: Record<string, { t: string; a: string; b: string }> = {
  // コード2: T=W, A=W, B=W
  "6F":    { t: "W",  a: "W",  b: "W"  },
  // コード7: T=RG, A=W, B=W（最も一般的な6F2Gパターン）
  "6F2G":  { t: "RG", a: "W",  b: "W"  },
  // コード5: T=RG, A=〜, B=W
  "4F2G":  { t: "RG", a: "〜", b: "W"  },
  // コード4: T=RG, A=〜, B=〜
  "2F2G":  { t: "RG", a: "〜", b: "〜" },
  // コード17: T=SG, A=W, B=W
  "6F2SG": { t: "SG", a: "W",  b: "W"  },
  // コード10: T=W, A=〜, B=W
  "4F":    { t: "W",  a: "〜", b: "W"  },
  // コード11: T=W, A=〜, B=〜
  "2F":    { t: "W",  a: "〜", b: "〜" },
  // コード16: T=〜, A=〜, B=〜
  "黒皮":  { t: "〜", a: "〜", b: "〜" },
}

// 仕上り名から加工指示を解決（完全一致 → 前方部分一致 → デフォルト6F=W/W/W）
function resolveCutCodes(specName: string): { t: string; a: string; b: string } {
  if (SHIAGARI_CUT_MAP[specName]) return SHIAGARI_CUT_MAP[specName]
  // "6F2G(特殊)" 等の前方一致
  for (const key of Object.keys(SHIAGARI_CUT_MAP)) {
    if (specName.startsWith(key)) return SHIAGARI_CUT_MAP[key]
  }
  return { t: "W", a: "W", b: "W" }
}

// 加工指示が全面確定（〜なし）かどうか → ENTERで寸法Tへスキップ判定
function allCutsDefined(cuts: { t: string; a: string; b: string }): boolean {
  return cuts.t !== "〜" && cuts.a !== "〜" && cuts.b !== "〜"
}

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"

// ─── 型定義 ───────────────────────────────────────────────────
interface Material  { materialCode: string; materialName: string }
interface ProcSpec  { processingSpecCode: number; processingSpecName: string }
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
function fmt(iso?: string | null) { return iso ? iso.slice(0, 10) : "" }

// ─── スタイル定数 ─────────────────────────────────────────────
const TH: React.CSSProperties = {
  background: "#1e3a5f", color: "#fff", fontSize: "10px", fontWeight: 600,
  padding: "3px 2px", textAlign: "center", border: "1px solid #334155", whiteSpace: "nowrap",
}
const TD: React.CSSProperties = {
  border: "1px solid #e2e8f0", padding: "2px 3px", verticalAlign: "middle",
}
const INP: React.CSSProperties = {
  width: "100%", border: "1px solid #cbd5e1", borderRadius: "3px",
  padding: "2px 4px", fontSize: "11px", background: "#fff", boxSizing: "border-box",
  height: "24px",
}
const SEL: React.CSSProperties = {
  width: "100%", border: "1px solid #cbd5e1", borderRadius: "3px",
  padding: "1px 2px", fontSize: "11px", background: "#fff", height: "24px",
}
const LBL: React.CSSProperties = {
  background: "#e8edf5", fontSize: "10px", fontWeight: 600, color: "#374151",
  padding: "3px 6px", border: "1px solid #d1d5db", whiteSpace: "nowrap",
}
const TOL_INP: React.CSSProperties = {
  ...INP, height: "22px", fontSize: "10px", textAlign: "right", padding: "1px 3px",
}
const FH = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.background = "#ffffcc"
    e.target.style.borderColor = "#f59e0b"
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.background = "#fff"
    e.target.style.borderColor = "#cbd5e1"
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

// ─── メインコンポーネント ────────────────────────────────────
export default function EstimateNewClient({ materials, processingSpecs, userInfo, copySource }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [estimateNo, setEstimateNo]   = useState("")
  const [orderNo, setOrderNo]         = useState("")
  const [inputDate, setInputDate]     = useState(today)
  const [estimateDate, setEstimateDate] = useState(today)
  const [custOrderNo, setCustOrderNo] = useState("")
  const [endUserNo, setEndUserNo]     = useState("")
  const [distCode, setDistCode]       = useState("")
  const [distName, setDistName]       = useState("")
  const [distDept, setDistDept]       = useState("")
  const [distPerson, setDistPerson]   = useState("")
  const [distZip, setDistZip]         = useState("")
  const [distAddr, setDistAddr]       = useState("")
  const [distTel, setDistTel]         = useState("")
  const [distFax, setDistFax]         = useState("")
  const [contact, setContact]         = useState("")
  const [shippingMethod, setShippingMethod] = useState("発送")

  const [form, setForm]       = useState<DetailForm>(newForm())
  const [details, setDetails] = useState<DetailForm[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving]   = useState(false)
  const [saveMsg, setSaveMsg] = useState("")
  const [draftId, setDraftId] = useState<string | null>(null)

  const [matProcMap, setMatProcMap] = useState<Record<string, number[]>>({})
  const [matSuggest, setMatSuggest] = useState("")
  const [specSuggest, setSpecSuggest] = useState("")
  const matInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch("/api/v1/masters/material-processing-map")
      .then(r => r.json()).then(d => { if (d.map) setMatProcMap(d.map) }).catch(() => {})
  }, [])

  const filteredSpecs: ProcSpec[] = form.materialCode && matProcMap[form.materialCode]
    ? processingSpecs.filter(s => matProcMap[form.materialCode].includes(s.processingSpecCode))
    : processingSpecs

  // ── 仕上り選択: WO加工仕様マップで加工指示を自動設定 ──
  // skipToSize=true の場合、全面確定なら直接寸法Tへフォーカス移動
  const handleSpecSelect = useCallback((specCode: number, skipToSize = false) => {
    const spec = processingSpecs.find(s => s.processingSpecCode === specCode)
    if (!spec) return
    const name = spec.processingSpecName ?? ""
    const cuts = resolveCutCodes(name)
    setForm(f => ({
      ...f,
      kakouShiyouCode: specCode,
      shiagari: name,
      kakouShijiCodeT: cuts.t,
      kakouShijiCodeA: cuts.a,
      kakouShijiCodeB: cuts.b,
      calculated: false,
    }))
    setSpecSuggest(name)
    if (skipToSize && allCutsDefined(cuts)) {
      setTimeout(() => focusById("f-sizeT"), 50)
    }
  }, [processingSpecs])

  // ── 材料選択: 6F優先でデフォルト仕上りを自動設定 ──
  const handleMaterialSelect = useCallback((code: string) => {
    const matName = materials.find(m => m.materialCode === code)?.materialName ?? code
    setMatSuggest(matName)
    const avail = code && matProcMap[code]
      ? processingSpecs.filter(s => matProcMap[code].includes(s.processingSpecCode))
      : processingSpecs
    const def6F  = avail.find(s => s.processingSpecName?.includes("6F"))
    const defSpec = def6F ?? avail[0]
    if (defSpec) {
      const cuts = resolveCutCodes(defSpec.processingSpecName)
      setForm(f => ({
        ...f,
        materialCode: code,
        kakouShiyouCode: defSpec.processingSpecCode,
        shiagari: defSpec.processingSpecName,
        kakouShijiCodeT: cuts.t,
        kakouShijiCodeA: cuts.a,
        kakouShijiCodeB: cuts.b,
        calculated: false,
      }))
      setSpecSuggest(defSpec.processingSpecName)
    } else {
      setForm(f => ({ ...f, materialCode: code, calculated: false }))
    }
    setTimeout(() => focusById("f-shiagari"), 50)
  }, [materials, processingSpecs, matProcMap])

  // ── 標準公差 ──
  const handleStdTol = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/v1/tolerance/standard?customerCode=${userInfo.customerCode}` +
        `&kakouShiyouCode=${form.kakouShiyouCode}&sizeT=${form.sizeT}&sizeB=${form.sizeB}&sizeA=${form.sizeA}`
      )
      const d = await res.json()
      if (d.success || d.tolerance) {
        const t = d.tolerance ?? d
        setForm(f => ({
          ...f,
          toleranceTUp: t.tUpper ?? 0, toleranceTDown: t.tLower ?? 0,
          toleranceBUp: t.bUpper ?? 0, toleranceBDown: t.bLower ?? 0,
          toleranceAUp: t.aUpper ?? 0, toleranceADown: t.aLower ?? 0,
        }))
      }
    } catch { /* silent */ }
    setTimeout(() => focusById("btn-std-chamfer"), 100)
  }, [userInfo.customerCode, form.kakouShiyouCode, form.sizeT, form.sizeB, form.sizeA])

  // ── 標準面取り ──
  const handleStdChamfer = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/chamfer/standard?customerCode=${userInfo.customerCode}`)
      const d = await res.json()
      if (d.success || d.chamfer) {
        const c = d.chamfer ?? d
        setForm(f => ({ ...f, mentori4: c.chamfer4 ?? 0, mentori8: c.chamfer8 ?? 0 }))
      }
    } catch { /* silent */ }
    setTimeout(() => focusById("f-qty"), 100)
  }, [userInfo.customerCode])

  // ── 計算 ──
  const handleCalculate = async () => {
    if (!form.materialCode || !form.kakouShiyouCode) { alert("材料と加工仕様を選択してください"); return }
    if (!form.sizeT || !form.sizeB || !form.sizeA) { alert("寸法T・巾・長さを入力してください"); return }
    const spec = processingSpecs.find(s => s.processingSpecCode === form.kakouShiyouCode)
    try {
      const res = await fetch("/api/v1/estimates/calculate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      })
      if (!res.ok) throw new Error("計算APIエラー " + res.status)
      const data = await res.json()
      setForm(f => ({
        ...f,
        unitPrice: data.unitPrice, totalPrice: data.totalPrice,
        deliveryDate: data.deliveryDate, deliveryDeadline: data.deliveryDeadline,
        fastDeliveryDate: data.fastDeliveryDate ?? data.deliveryDate,
        fastDeliveryDeadline: data.fastDeliveryDeadline ?? data.deliveryDeadline,
        calculated: true,
      }))
      setTimeout(() => focusById("btn-add"), 50)
    } catch (e: any) { alert("見積計算に失敗しました: " + e.message) }
  }

  const handleAdd = () => {
    if (!form.calculated) return
    setDetails(p => [...p, { ...form }])
    const m = form.materialCode
    const matName = materials.find(x => x.materialCode === m)?.materialName ?? ""
    setForm({ ...newForm(), materialCode: m })
    setMatSuggest(matName)
    setSpecSuggest("")
    setTimeout(() => focusById("f-mat-suggest"), 50)
  }
  const handleDel = (id: string) => {
    setDetails(p => p.filter(d => d.clientDetailId !== id))
    setSelectedIds(p => { const n = new Set(p); n.delete(id); return n })
  }
  const selAll = (v: boolean) => setSelectedIds(v ? new Set(details.map(d => d.clientDetailId)) : new Set())
  const selOne = (id: string, v: boolean) => setSelectedIds(p => { const n = new Set(p); v ? n.add(id) : n.delete(id); return n })

  const handleSave = async () => {
    setSaving(true); setSaveMsg("保存中...")
    try {
      const res = await fetch("/api/v1/estimates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateId: draftId,
          header: {
            inputDate, estimateDate, shippingMethodId: 1,
            destinationCode: distCode, destinationName: distName,
            destinationDept: distDept, destinationPerson: distPerson,
            destinationZip: distZip, destinationAddress: distAddr,
            destinationTel: distTel, destinationFax: distFax,
            contact, customerOrderNo: custOrderNo, endUserNo, remarks: contact,
          },
          details: details.map((d, i) => ({ ...d, rowNo: i + 1 })),
        }),
      })
      if (!res.ok) throw new Error("保存失敗")
      const data = await res.json()
      setDraftId(data.estimateId ?? data.id)
      setEstimateNo(data.estimateNo ?? "")
      setSaveMsg("✅ 保存完了！見積番号: " + (data.estimateNo ?? ""))
    } catch (e: any) { setSaveMsg("❌ 保存失敗: " + e.message) }
    finally { setSaving(false); setTimeout(() => setSaveMsg(""), 4000) }
  }

  const handleOrder = async () => {
    const sel = details.filter(d => selectedIds.has(d.clientDetailId))
    if (sel.length === 0) { alert("注文する明細を選択してください"); return }
    await handleSave()
    if (draftId) window.location.href = "/orders/confirm?estimateId=" + draftId
  }

  const handleDistSearch = async () => {
    if (!distCode) return
    try {
      const res = await fetch(`/api/v1/masters/direct-delivery/search?code=${distCode}&customerCode=${userInfo.customerCode}`)
      const d = await res.json()
      if (d.delivery) {
        const dd = d.delivery
        setDistName(dd.name ?? dd.companyName ?? "")
        setDistDept(dd.department ?? dd.departmentName ?? "")
        setDistPerson(dd.person ?? dd.contactPerson ?? "")
        setDistZip(dd.zipCode ?? dd.postalCode ?? "")
        setDistAddr(dd.address ?? dd.address1 ?? "")
        setDistTel(dd.tel ?? dd.phoneNumber ?? "")
        setDistFax(dd.fax ?? dd.faxNumber ?? "")
      }
    } catch { /* silent */ }
  }

  const handleZip = async () => {
    const zip = distZip.replace(/-/g, "")
    if (zip.length !== 7) return
    try {
      const res = await fetch(`/api/v1/postal-code?zip=${zip}`)
      const d = await res.json()
      if (d.address) setDistAddr(d.address)
    } catch { /* silent */ }
  }

  return (
    <div style={{ fontSize: "11px", padding: "4px 8px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* ─── ヘッダーボタン ─── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
        <div style={{ fontWeight: 700, fontSize: "13px", color: "#1e3a5f" }}>お見積り入力</div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button className="btn-ochi btn-outline" style={{ fontSize: "11px" }}
            onClick={() => { setForm(newForm()); setMatSuggest(""); setSpecSuggest("") }}>新規</button>
          <button className="btn-ochi btn-primary" style={{ fontSize: "11px" }}
            onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "この見積りを保存"}</button>
          <button className="btn-ochi" style={{ fontSize: "11px", background: "#92400e", color: "#fff" }}
            onClick={handleOrder}>この見積りを注文</button>
          <Link href="/dashboard">
            <button className="btn-ochi btn-outline" style={{ fontSize: "11px" }}>← メインメニュー</button>
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
            <td style={{ ...TD, width: "130px" }}><input id="f-orderNo" style={INP} value={orderNo} onChange={e => setOrderNo(e.target.value)} onKeyDown={onEnter("f-inputDate")} {...FH} /></td>
            <td style={LBL}>入力日付</td>
            <td style={{ ...TD, width: "120px" }}><input id="f-inputDate" style={INP} type="date" value={inputDate} onChange={e => setInputDate(e.target.value)} onKeyDown={onEnter("f-estDate")} {...FH} /></td>
            <td style={LBL}>見積日付</td>
            <td style={{ ...TD, width: "120px" }}><input id="f-estDate" style={INP} type="date" value={estimateDate} onChange={e => setEstimateDate(e.target.value)} onKeyDown={onEnter("f-shippingMethod")} {...FH} /></td>
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
        <select id="f-shippingMethod" style={{ ...SEL, width: "100px" }} value={shippingMethod} onChange={e => setShippingMethod(e.target.value)} onKeyDown={onEnter("f-distCode")} {...FH}>
          <option value="発送">発送</option><option value="直送">直送</option><option value="持参">持参</option>
        </select>
        <span style={{ fontSize: "10px", color: "#94a3b8" }}>リストよりお選びください</span>
      </div>

      {/* ─── 送り先情報 ─── */}
      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 4px 4px", padding: "6px 10px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#1e3a5f", marginBottom: "5px" }}>送り先情報</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr", gap: "4px 8px", alignItems: "end", marginBottom: "4px" }}>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>出荷先</div>
            <div style={{ display: "flex", gap: "3px" }}>
              <input id="f-distCode" style={{ ...INP, width: "70px" }} value={distCode} onChange={e => setDistCode(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleDistSearch().then(() => focusById("f-distName")) } }} {...FH} />
              <button className="btn-ochi btn-outline" style={{ fontSize: "10px", padding: "1px 6px", height: "24px" }}
                onClick={() => handleDistSearch().then(() => focusById("f-distName"))}>🔍</button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>出荷先名</div>
            <input id="f-distName" style={INP} value={distName} onChange={e => setDistName(e.target.value)} onKeyDown={onEnter("f-distDept")} {...FH} />
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>出荷先部署</div>
            <input id="f-distDept" style={INP} value={distDept} onChange={e => setDistDept(e.target.value)} onKeyDown={onEnter("f-distPerson")} {...FH} />
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>ご担当者</div>
            <input id="f-distPerson" style={INP} value={distPerson} onChange={e => setDistPerson(e.target.value)} onKeyDown={onEnter("f-distZip")} {...FH} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 160px 160px", gap: "4px 8px", marginBottom: "4px" }}>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>〒</div>
            <div style={{ display: "flex", gap: "3px" }}>
              <input id="f-distZip" style={{ ...INP, flex: 1 }} value={distZip} onChange={e => setDistZip(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleZip().then(() => focusById("f-distAddr")) } }}
                placeholder="0000000" {...FH} />
              <button className="btn-ochi btn-outline" style={{ fontSize: "9px", padding: "0 4px", height: "24px" }}
                onClick={() => handleZip().then(() => focusById("f-distAddr"))}>検索</button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>住所</div>
            <input id="f-distAddr" style={INP} value={distAddr} onChange={e => setDistAddr(e.target.value)} onKeyDown={onEnter("f-distTel")} {...FH} />
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>TEL</div>
            <input id="f-distTel" style={INP} value={distTel} onChange={e => setDistTel(e.target.value)} onKeyDown={onEnter("f-distFax")} {...FH} />
          </div>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>FAX</div>
            <input id="f-distFax" style={INP} value={distFax} onChange={e => setDistFax(e.target.value)} onKeyDown={onEnter("f-contact")} {...FH} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: "10px", fontWeight: 600, marginBottom: "2px" }}>通信欄</div>
          <input id="f-contact" style={INP} value={contact} onChange={e => setContact(e.target.value)} onKeyDown={onEnter("f-mat-suggest")} {...FH} />
        </div>
      </div>

      {/* ─── 見積明細編集 ─── */}
      <div style={{ fontSize: "11px", fontWeight: 600, background: "#d8e9f5", color: "#1e3a5f", padding: "3px 8px", borderRadius: "4px 4px 0 0", marginTop: "8px" }}>見積明細編集</div>
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0" }}>
        <datalist id="dl-materials">
          {materials.map(m => <option key={m.materialCode} value={m.materialName || m.materialCode} />)}
        </datalist>
        <datalist id="dl-specs">
          {filteredSpecs.map(s => <option key={s.processingSpecCode} value={s.processingSpecName} />)}
        </datalist>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "32px" }} />{/* No */}
            <col style={{ width: "90px" }} />{/* 材料 */}
            <col style={{ width: "90px" }} />{/* 仕上り */}
            <col style={{ width: "40px" }} />{/* 加工T */}
            <col style={{ width: "40px" }} />{/* 加工巾 */}
            <col style={{ width: "40px" }} />{/* 加工長 */}
            <col style={{ width: "58px" }} />{/* 寸法T */}
            <col style={{ width: "62px" }} />{/* 寸法巾 */}
            <col style={{ width: "66px" }} />{/* 寸法長 */}
            <col style={{ width: "40px" }} />{/* 標準公差 */}
            <col style={{ width: "44px" }} />{/* 公差T */}
            <col style={{ width: "44px" }} />{/* 公差巾 */}
            <col style={{ width: "44px" }} />{/* 公差長 */}
            <col style={{ width: "66px" }} />{/* 面取図 */}
            <col style={{ width: "40px" }} />{/* 4角 */}
            <col style={{ width: "40px" }} />{/* 8辺 */}
            <col style={{ width: "42px" }} />{/* 数量 */}
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
              <td style={{ ...TD, textAlign: "center", color: "#94a3b8", fontSize: "10px" }}>—</td>

              {/* 材料: サジェスト */}
              <td style={TD}>
                <input id="f-mat-suggest" ref={matInputRef} list="dl-materials" style={SEL}
                  value={matSuggest}
                  onChange={e => {
                    const v = e.target.value; setMatSuggest(v)
                    const hit = materials.find(m => m.materialName === v || m.materialCode === v)
                    if (hit) handleMaterialSelect(hit.materialCode)
                  }}
                  onKeyDown={e => {
                    if (e.key !== "Enter") return; e.preventDefault()
                    const hit = materials.find(m => m.materialName === matSuggest || m.materialCode === matSuggest)
                    if (hit) handleMaterialSelect(hit.materialCode)
                    else focusById("f-shiagari")
                  }}
                  placeholder="材料名入力" {...FH} />
              </td>

              {/* 仕上り: サジェスト + ENTER時に加工仕様確定→全面W/W/Wなら寸法Tへ */}
              <td style={TD}>
                <input id="f-shiagari" list="dl-specs" style={SEL}
                  value={specSuggest}
                  onChange={e => {
                    const v = e.target.value; setSpecSuggest(v)
                    const hit = filteredSpecs.find(s => s.processingSpecName === v)
                    if (hit) handleSpecSelect(hit.processingSpecCode, false)
                  }}
                  onKeyDown={e => {
                    if (e.key !== "Enter") return; e.preventDefault()
                    const hit = filteredSpecs.find(s => s.processingSpecName === specSuggest)
                    if (hit) {
                      const cuts = resolveCutCodes(hit.processingSpecName)
                      // 全面確定（〜なし）→ 寸法Tへスキップ、そうでない→ 加工仕様Tへ
                      handleSpecSelect(hit.processingSpecCode, false)
                      if (allCutsDefined(cuts)) {
                        setTimeout(() => focusById("f-sizeT"), 50)
                      } else {
                        setTimeout(() => focusById("f-cutT"), 50)
                      }
                    } else {
                      focusById("f-cutT")
                    }
                  }}
                  placeholder="仕上り選択" {...FH} />
              </td>

              {/* 加工仕様: 厚み/巾/長さ */}
              <td style={TD}>
                <select id="f-cutT" style={SEL} value={form.kakouShijiCodeT}
                  onChange={e => setForm(f => ({ ...f, kakouShijiCodeT: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); focusById(form.kakouShijiCodeA !== "〜" ? "f-cutA" : "f-sizeT") } }} {...FH}>
                  <option value="W">W</option><option value="G">G</option>
                  <option value="〜">〜</option><option value="RG">RG</option><option value="SG">SG</option>
                </select>
              </td>
              <td style={TD}>
                <select id="f-cutA" style={SEL} value={form.kakouShijiCodeA}
                  onChange={e => setForm(f => ({ ...f, kakouShijiCodeA: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); focusById(form.kakouShijiCodeB !== "〜" ? "f-cutB" : "f-sizeT") } }} {...FH}>
                  <option value="W">W</option><option value="G">G</option>
                  <option value="〜">〜</option><option value="RG">RG</option><option value="SG">SG</option>
                </select>
              </td>
              <td style={TD}>
                <select id="f-cutB" style={SEL} value={form.kakouShijiCodeB}
                  onChange={e => setForm(f => ({ ...f, kakouShijiCodeB: e.target.value }))}
                  onKeyDown={onEnter("f-sizeT")} {...FH}>
                  <option value="W">W</option><option value="G">G</option>
                  <option value="〜">〜</option><option value="RG">RG</option><option value="SG">SG</option>
                </select>
              </td>

              {/* 寸法: 厚み/巾/長さ */}
              <td style={TD}>
                <input id="f-sizeT" style={{ ...INP, textAlign: "right" }} type="number" step="0.001"
                  value={form.sizeT || ""}
                  onChange={e => setForm(f => ({ ...f, sizeT: parseFloat(e.target.value) || 0, calculated: false }))}
                  onKeyDown={onEnter("f-sizeA")} {...FH} />
              </td>
              <td style={TD}>
                <input id="f-sizeA" style={{ ...INP, textAlign: "right" }} type="number" step="0.001"
                  value={form.sizeA || ""}
                  onChange={e => setForm(f => ({ ...f, sizeA: parseFloat(e.target.value) || 0 }))}
                  onKeyDown={onEnter("f-sizeB")} {...FH} />
              </td>
              <td style={TD}>
                <input id="f-sizeB" style={{ ...INP, textAlign: "right" }} type="number" step="0.001"
                  value={form.sizeB || ""}
                  onChange={e => setForm(f => ({ ...f, sizeB: parseFloat(e.target.value) || 0 }))}
                  onKeyDown={onEnter("btn-std-tol")} {...FH} />
              </td>

              {/* 標準公差ボタン */}
              <td style={{ ...TD, textAlign: "center", padding: "2px" }}>
                <button id="btn-std-tol" className="btn-ochi btn-outline"
                  style={{ fontSize: "9px", padding: "2px 5px", width: "100%", height: "24px" }}
                  onClick={handleStdTol}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleStdTol() } }}>標準</button>
              </td>

              {/* 公差: 上下2段 */}
              <td style={{ ...TD, padding: "1px 2px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <input id="f-tolTUp" style={TOL_INP} type="number" step="0.001"
                    value={form.toleranceTUp || ""}
                    onChange={e => setForm(f => ({ ...f, toleranceTUp: parseFloat(e.target.value) || 0 }))}
                    onKeyDown={onEnter("f-tolTDn")} {...FH} />
                  <input id="f-tolTDn" style={TOL_INP} type="number" step="0.001"
                    value={form.toleranceTDown || ""}
                    onChange={e => setForm(f => ({ ...f, toleranceTDown: parseFloat(e.target.value) || 0 }))}
                    onKeyDown={onEnter("f-tolAUp")} {...FH} />
                </div>
              </td>
              <td style={{ ...TD, padding: "1px 2px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <input id="f-tolAUp" style={TOL_INP} type="number" step="0.001"
                    value={form.toleranceAUp || ""}
                    onChange={e => setForm(f => ({ ...f, toleranceAUp: parseFloat(e.target.value) || 0 }))}
                    onKeyDown={onEnter("f-tolADn")} {...FH} />
                  <input id="f-tolADn" style={TOL_INP} type="number" step="0.001"
                    value={form.toleranceADown || ""}
                    onChange={e => setForm(f => ({ ...f, toleranceADown: parseFloat(e.target.value) || 0 }))}
                    onKeyDown={onEnter("f-tolBUp")} {...FH} />
                </div>
              </td>
              <td style={{ ...TD, padding: "1px 2px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <input id="f-tolBUp" style={TOL_INP} type="number" step="0.001"
                    value={form.toleranceBUp || ""}
                    onChange={e => setForm(f => ({ ...f, toleranceBUp: parseFloat(e.target.value) || 0 }))}
                    onKeyDown={onEnter("f-tolBDn")} {...FH} />
                  <input id="f-tolBDn" style={TOL_INP} type="number" step="0.001"
                    value={form.toleranceBDown || ""}
                    onChange={e => setForm(f => ({ ...f, toleranceBDown: parseFloat(e.target.value) || 0 }))}
                    onKeyDown={onEnter("btn-std-chamfer")} {...FH} />
                </div>
              </td>

              {/* 面取り */}
              <td style={{ ...TD, textAlign: "center", padding: "2px 3px" }}>
                <select style={{ ...SEL, fontSize: "9px", height: "22px", marginBottom: "2px" }}
                  value={form.mentoriShiji}
                  onChange={e => setForm(f => ({ ...f, mentoriShiji: parseInt(e.target.value) }))} {...FH}>
                  <option value={1}>面取図参照</option>
                  <option value={2}>面取不可</option>
                  <option value={9}>---</option>
                </select>
                <button id="btn-std-chamfer" className="btn-ochi btn-outline"
                  style={{ fontSize: "8px", padding: "0 3px", display: "block", width: "100%", height: "20px" }}
                  onClick={handleStdChamfer}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleStdChamfer() } }}>標準</button>
              </td>
              <td style={TD}>
                <input id="f-mentori4" style={{ ...INP, textAlign: "right" }} type="number" step="0.1"
                  value={form.mentori4 || ""}
                  onChange={e => setForm(f => ({ ...f, mentori4: parseFloat(e.target.value) || 0 }))}
                  onKeyDown={onEnter("f-mentori8")} {...FH} />
              </td>
              <td style={TD}>
                <input id="f-mentori8" style={{ ...INP, textAlign: "right" }} type="number" step="0.1"
                  value={form.mentori8 || ""}
                  onChange={e => setForm(f => ({ ...f, mentori8: parseFloat(e.target.value) || 0 }))}
                  onKeyDown={onEnter("f-qty")} {...FH} />
              </td>
              <td style={TD}>
                <input id="f-qty" style={{ ...INP, textAlign: "right" }} type="number" min="1"
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
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
                      onChange={e => setForm(f => ({ ...f, customerDetailOrderNo: e.target.value }))}
                      onKeyDown={onEnter("f-destDetailNo")} {...FH} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: "180px" }}>
                    <span style={{ fontSize: "9px", color: "#64748b" }}>送り先注文番号</span>
                    <input id="f-destDetailNo" style={INP} value={form.destinationDetailOrderNo}
                      onChange={e => setForm(f => ({ ...f, destinationDetailOrderNo: e.target.value }))}
                      onKeyDown={onEnter("f-remarks")} {...FH} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1px", flex: 1 }}>
                    <span style={{ fontSize: "9px", color: "#64748b" }}>備考</span>
                    <input id="f-remarks" style={INP} value={form.remarks}
                      onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                      onKeyDown={onEnter("btn-calc")} {...FH} />
                  </div>
                </div>
              </td>
            </tr>

            {/* 計算結果・ボタン */}
            <tr>
              <td colSpan={2} style={{ ...TD, padding: "4px" }}>
                <div style={{ fontSize: "9px", color: "#64748b" }}>最短納期</div>
                <input style={{ ...INP, background: "#f8fafc", color: "#64748b", fontSize: "10px" }} value={fmt(form.fastDeliveryDate)} readOnly />
              </td>
              <td colSpan={6} style={{ ...TD, padding: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: "9px", color: "#64748b" }}>納期保証期限</div>
                    <input style={{ ...INP, width: "130px", background: form.fastDeliveryDeadline ? "#ffffcc" : "#fff", borderColor: form.fastDeliveryDeadline ? "#f59e0b" : "#cbd5e1" }} value={fmt(form.fastDeliveryDeadline)} readOnly />
                  </div>
                  <div>
                    <div style={{ fontSize: "9px", color: "#64748b" }}>送料込みプレート単価</div>
                    <input style={{ ...INP, width: "95px", textAlign: "right", background: "#f8fafc", fontFamily: "monospace" }} value={form.unitPrice != null ? "¥" + form.unitPrice.toLocaleString() : ""} readOnly />
                  </div>
                  <div>
                    <div style={{ fontSize: "9px", color: "#64748b" }}>送料込みプレート金額</div>
                    <input style={{ ...INP, width: "95px", textAlign: "right", background: "#f8fafc", fontFamily: "monospace" }} value={form.totalPrice != null ? "¥" + form.totalPrice.toLocaleString() : ""} readOnly />
                  </div>
                </div>
              </td>
              <td colSpan={9} style={{ ...TD, padding: "4px" }}>
                <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                  <button id="btn-calc" className="btn-ochi btn-primary"
                    style={{ fontSize: "11px", minWidth: "90px" }}
                    onClick={handleCalculate}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCalculate() } }}>
                    📊 見積計算
                  </button>
                  <button id="btn-add" className="btn-ochi btn-primary"
                    style={{ fontSize: "11px", minWidth: "90px", background: form.calculated ? "#16a34a" : "#94a3b8", cursor: form.calculated ? "pointer" : "not-allowed" }}
                    onClick={handleAdd} disabled={!form.calculated}
                    onKeyDown={e => { if (e.key === "Enter" && form.calculated) { e.preventDefault(); handleAdd() } }}>
                    ＋ 明細に追加
                  </button>
                  <button className="btn-ochi btn-outline" style={{ fontSize: "11px" }}
                    onClick={() => { setForm(newForm()); setMatSuggest(""); setSpecSuggest(""); setTimeout(() => focusById("f-mat-suggest"), 50) }}>
                    クリア
                  </button>
                </div>
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
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
          <thead>
            <tr>
              <th style={{ ...TH, background: "#166534", width: "28px" }}>
                <input type="checkbox" onChange={e => selAll(e.target.checked)} checked={details.length > 0 && selectedIds.size === details.length} />
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
              <th style={{ ...TH, background: "#166534" }}>ご注文番号</th>
              <th style={{ ...TH, background: "#166534" }}>単価</th>
              <th style={{ ...TH, background: "#166534" }}>金額</th>
              <th style={{ ...TH, background: "#166534" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {details.length === 0 ? (
              <tr><td colSpan={14} style={{ ...TD, textAlign: "center", padding: "12px", color: "#94a3b8" }}>明細がありません。上のフォームで入力後「明細に追加」してください。</td></tr>
            ) : details.map((d, i) => (
              <tr key={d.clientDetailId} style={{ background: i % 2 === 0 ? "#fff" : "#f0fdf4" }}>
                <td style={{ ...TD, textAlign: "center" }}><input type="checkbox" checked={selectedIds.has(d.clientDetailId)} onChange={e => selOne(d.clientDetailId, e.target.checked)} /></td>
                <td style={{ ...TD, textAlign: "center" }}>{i + 1}</td>
                <td style={TD}>{d.materialCode}</td>
                <td style={TD}>{d.shiagari}</td>
                <td style={{ ...TD, textAlign: "right" }}>{d.sizeT}</td>
                <td style={{ ...TD, textAlign: "right" }}>{d.sizeA}</td>
                <td style={{ ...TD, textAlign: "right" }}>{d.sizeB}</td>
                <td style={{ ...TD, textAlign: "center" }}>{d.mentori4 ? `4C:${d.mentori4}` : ""}{d.mentori8 ? ` 8C:${d.mentori8}` : ""}</td>
                <td style={{ ...TD, textAlign: "right" }}>{d.quantity}</td>
                <td style={{ ...TD, textAlign: "center", color: isExpired(d.deliveryDeadline) ? "#ef4444" : "#374151" }}>
                  {fmt(d.fastDeliveryDate)}{isExpired(d.deliveryDeadline) && <span style={{ color: "#ef4444", fontSize: "9px" }}> ⚠期限切</span>}
                </td>
                <td style={TD}>{d.customerDetailOrderNo}</td>
                <td style={{ ...TD, textAlign: "right", fontFamily: "monospace" }}>{d.unitPrice != null ? "¥" + d.unitPrice.toLocaleString() : "—"}</td>
                <td style={{ ...TD, textAlign: "right", fontFamily: "monospace" }}>{d.totalPrice != null ? "¥" + d.totalPrice.toLocaleString() : "—"}</td>
                <td style={{ ...TD, textAlign: "center" }}>
                  <button className="btn-ochi btn-outline" style={{ fontSize: "9px", padding: "1px 5px" }} onClick={() => handleDel(d.clientDetailId)}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
