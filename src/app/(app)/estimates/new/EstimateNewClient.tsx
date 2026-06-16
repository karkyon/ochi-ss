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
import { useState, useEffect, useRef } from "react"
import Link from "next/link"

// ─── 型定義 ───────────────────────────────────────────────────
interface Material    { materialCode: string; materialName: string }
interface ProcSpec    { processingSpecCode: number; processingSpecName: string }
interface CutMethod   { code: number; label: string }  // APIレスポンスそのまま
interface UserInfo    { customerId: string; customerCode: string; userName: string; companyName: string }

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
  cuttingMethods: any[]  // unused, fetched on client
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

// ─── スタイル ──────────────────────────────────────────────────
const TH: React.CSSProperties = {
  background: "linear-gradient(to bottom,#f1f5f9,#e2e8f0)",
  border: "1px solid #cbd5e1", padding: "3px 4px",
  textAlign: "center", fontWeight: 600, fontSize: "11px",
  color: "#334155", whiteSpace: "nowrap", verticalAlign: "middle",
}
const TD: React.CSSProperties = {
  border: "1px solid #e2e8f0", padding: "2px 3px",
  verticalAlign: "middle", background: "#fff", fontSize: "11px",
}
const LBL: React.CSSProperties = {
  background: "linear-gradient(to right,#f1f5f9,#e8eef4)",
  fontWeight: 600, color: "#475569", fontSize: "11px",
  textAlign: "center" as const, whiteSpace: "nowrap" as const,
  padding: "2px 6px", border: "1px solid #e2e8f0", verticalAlign: "middle" as const,
}
const INP: React.CSSProperties = {
  height: "24px", border: "1px solid #cbd5e1", borderRadius: "3px",
  padding: "0 4px", fontSize: "11px", width: "100%", background: "#fff",
}
const SEL: React.CSSProperties = {
  height: "24px", border: "1px solid #cbd5e1", borderRadius: "3px",
  padding: "0 2px", fontSize: "11px", width: "100%", background: "#fff",
}
const onF = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
  e.target.style.background = "#ffffcc"; e.target.style.borderColor = "#f59e0b"; e.target.style.outline = "none"
}
const onB = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
  e.target.style.background = "#fff"; e.target.style.borderColor = "#cbd5e1"
}
const FH = { onFocus: onF, onBlur: onB }

// Enterキーで次フィールドへ移動
function onEnter(nextId: string) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      document.getElementById(nextId)?.focus()
    }
  }
}

// ─── メインコンポーネント ──────────────────────────────────────
export default function EstimateNewClient({ materials, processingSpecs, userInfo, copySource, isCopy }: Props) {
  const today = new Date().toISOString().slice(0, 10)

  // ヘッダー
  const [estimateNo,   setEstimateNo]   = useState(isCopy ? "" : (copySource?.estimateNo ?? ""))
  const [orderNo,      setOrderNo]      = useState("")
  const [inputDate,    setInputDate]    = useState(today)
  const [estimateDate, setEstimateDate] = useState(today)
  const [shippingMethod, setShippingMethod] = useState(copySource?.shippingMethod ?? "delivery")
  // 送り先
  const [distCode,   setDistCode]   = useState(copySource?.destinationCode ?? "")
  const [distName,   setDistName]   = useState(copySource?.destinationName ?? "")
  const [distDept,   setDistDept]   = useState(copySource?.destinationDept ?? "")
  const [distPerson, setDistPerson] = useState(copySource?.destinationPerson ?? "")
  const [distZip,    setDistZip]    = useState(copySource?.destinationZip ?? "")
  const [distAddr,   setDistAddr]   = useState(copySource?.destinationAddress ?? "")
  const [distTel,    setDistTel]    = useState(copySource?.destinationTel ?? "")
  const [distFax,    setDistFax]    = useState(copySource?.destinationFax ?? "")
  const [contact,    setContact]    = useState(copySource?.contact ?? "")
  const [custOrderNo, setCustOrderNo] = useState(copySource?.customerOrderNo ?? "")
  const [endUserNo,   setEndUserNo]   = useState(copySource?.endUserNo ?? "")

  // 明細
  const [form, setForm] = useState<DetailForm>(newForm())
  const [details, setDetails] = useState<DetailForm[]>(copySource?.details ?? [])

  // マスタ
  const [cutMethods, setCutMethods] = useState<CutMethod[]>([])
  const [matProcMap, setMatProcMap] = useState<Record<string, number[]>>({})

  // 選択
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const isAllSel = details.length > 0 && details.every(d => selectedIds.has(d.clientDetailId))

  // 保存
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")
  const [draftId, setDraftId] = useState<string | null>(copySource?.estimateId ?? null)

  // モーダル
  const [showModal, setShowModal] = useState(false)
  const [mSearch, setMSearch]   = useState({ name: "", address: "", code: "", tel: "" })
  const [mResults, setMResults] = useState<any[]>([])
  const [mLoading, setMLoading] = useState(false)

  // ─── 初期化 ────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/v1/cutting-methods?customerCode=" + userInfo.customerCode)
      .then(r => r.json())
      .then(d => { if (d.methods) setCutMethods(d.methods) })
      .catch(() => {})
  }, [userInfo.customerCode])

  useEffect(() => {
    fetch("/api/v1/masters/material-processing-map")
      .then(r => r.json())
      .then(d => { if (d.map) setMatProcMap(d.map) })
      .catch(() => {})
  }, [])

  // 加工仕様フィルタ
  const filteredSpecs = matProcMap[form.materialCode]
    ? processingSpecs.filter(s => matProcMap[form.materialCode].includes(s.processingSpecCode))
    : processingSpecs

  // 仕上りリスト: 加工仕様コードに対応するprocessingSpecName（スペックが選ばれたら自動セット）
  useEffect(() => {
    if (form.kakouShiyouCode) {
      const spec = processingSpecs.find(s => s.processingSpecCode === form.kakouShiyouCode)
      if (spec) setForm(f => ({ ...f, shiagari: spec.processingSpecName }))
    }
  }, [form.kakouShiyouCode])

  // ─── 計算 ──────────────────────────────────────────────────
  const handleCalculate = async () => {
    if (!form.materialCode || !form.kakouShiyouCode) { alert("材料と加工仕様を選択してください"); return }
    if (!form.sizeT || !form.sizeB || !form.sizeA) { alert("寸法T・B・Aを入力してください"); return }
    const spec = processingSpecs.find(s => s.processingSpecCode === form.kakouShiyouCode)
    const kakouTLabel = cutMethods.find(c => String(c.code) === String(form.kakouShijiCodeT))?.label ?? form.kakouShijiCodeT
    const kakouBLabel = cutMethods.find(c => String(c.code) === String(form.kakouShijiCodeB))?.label ?? form.kakouShijiCodeB
    const kakouALabel = cutMethods.find(c => String(c.code) === String(form.kakouShijiCodeA))?.label ?? form.kakouShijiCodeA
    try {
      const res = await fetch("/api/v1/estimates/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerCode: userInfo.customerCode,
          materialCode: form.materialCode,
          kakouShiyouCode: form.kakouShiyouCode,
          kakouShiyou: spec?.processingSpecName ?? "",
          kakouShijiCodeT: form.kakouShijiCodeT,
          kakouShijiCodeA: form.kakouShijiCodeA,
          kakouShijiCodeB: form.kakouShijiCodeB,
          kakouT: kakouTLabel, kakouA: kakouALabel, kakouB: kakouBLabel,
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
    } catch (e: any) { alert("見積計算に失敗しました: " + e.message) }
  }

  // ─── 明細追加・削除 ────────────────────────────────────────
  const handleAdd = () => {
    if (!form.calculated) return
    setDetails(p => [...p, { ...form }])
    setForm(newForm())
  }
  const handleDel = (id: string) => {
    setDetails(p => p.filter(d => d.clientDetailId !== id))
    setSelectedIds(p => { const n = new Set(p); n.delete(id); return n })
  }

  // ─── 全選択 ────────────────────────────────────────────────
  const selAll = (v: boolean) => setSelectedIds(v ? new Set(details.map(d => d.clientDetailId)) : new Set())
  const selOne = (id: string, v: boolean) => setSelectedIds(p => { const n = new Set(p); v ? n.add(id) : n.delete(id); return n })

  // ─── 保存 ──────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true); setSaveMsg("保存中...")
    try {
      const payload = {
        estimateId: draftId,
        header: {
          inputDate, estimateDate, shippingMethodId: 1,
          destinationCode: distCode, destinationName: distName,
          destinationDept: distDept, destinationPerson: distPerson,
          destinationZip: distZip, destinationAddress: distAddr,
          destinationTel: distTel, destinationFax: distFax,
          contact, customerOrderNo: custOrderNo, endUserNo,
          remarks: contact,
        },
        details: details.map((d, i) => ({ ...d, rowNo: i + 1 })),
      }
      const res = await fetch("/api/v1/estimates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  // ─── 標準公差・面取り ───────────────────────────────────────
  const handleStdTol = async () => {
    try {
      const res = await fetch("/api/v1/tolerance/standard?customerCode=" + userInfo.customerCode + "&kakouShiyouCode=" + form.kakouShiyouCode + "&sizeT=" + form.sizeT + "&sizeB=" + form.sizeB + "&sizeA=" + form.sizeA)
      const d = await res.json()
      if (d.success || d.tolerance) {
        const t = d.tolerance ?? d
        setForm(f => ({ ...f, toleranceTUp: t.tUpper ?? t.up ?? 0, toleranceTDown: t.tLower ?? t.down ?? 0, toleranceBUp: t.bUpper ?? 0, toleranceBDown: t.bLower ?? 0, toleranceAUp: t.aUpper ?? 0, toleranceADown: t.aLower ?? 0 }))
      }
    } catch { /* サイレント */ }
  }
  const handleStdChamfer = async () => {
    try {
      const res = await fetch("/api/v1/chamfer/standard?customerCode=" + userInfo.customerCode + "&kakouShiyouCode=" + form.kakouShiyouCode + "&sizeT=" + form.sizeT + "&sizeB=" + form.sizeB + "&sizeA=" + form.sizeA)
      const d = await res.json()
      if (d.success || d.chamfer) {
        const c = d.chamfer ?? d
        setForm(f => ({ ...f, mentori4: c.chamfer4 ?? c.c4 ?? 0, mentori8: c.chamfer8 ?? c.c8 ?? 0 }))
      }
    } catch { /* サイレント */ }
  }

  // ─── 直送先検索 ────────────────────────────────────────────
  const handleMSearch = async () => {
    setMLoading(true)
    try {
      const q = new URLSearchParams({ ...mSearch, customerCode: userInfo.customerCode })
      const res = await fetch("/api/v1/direct-deliveries/search?" + q)
      const d = await res.json()
      setMResults(d.destinations ?? d.results ?? [])
    } catch { setMResults([]) }
    finally { setMLoading(false) }
  }
  const handleMSel = (row: any) => {
    setDistCode(row.deliveryCode ?? row.destinationCode ?? "")
    setDistName(row.companyName ?? row.destinationName ?? "")
    setDistDept(row.departmentName ?? "")
    setDistPerson(row.contactPerson ?? row.personName ?? "")
    setDistZip(row.postalCode ?? "")
    setDistAddr([row.address1, row.address2, row.address3].filter(Boolean).join(" ") || row.address || "")
    setDistTel(row.phoneNumber ?? row.tel ?? "")
    setDistFax(row.faxNumber ?? row.fax ?? "")
    setShowModal(false)
  }

  // 郵便番号→住所自動入力
  const handlePostalSearch = async (zip: string) => {
    const normalized = zip.replace(/-/g, "")
    if (normalized.length !== 7) return
    try {
      const res = await fetch("/api/v1/postal-code?zip=" + normalized)
      if (!res.ok) return
      const d = await res.json()
      if (d.address1) {
        setDistAddr((d.address1 ?? "") + (d.address2 ?? "") + (d.address3 ?? ""))
        // 住所フィールドにフォーカス移動
        setTimeout(() => document.getElementById("f-distAddr")?.focus(), 100)
      }
    } catch { /* サイレント */ }
  }

  const totalAmt = details.reduce((s, d) => s + (d.totalPrice ?? 0), 0)
  const selAmt   = details.filter(d => selectedIds.has(d.clientDetailId)).reduce((s, d) => s + (d.totalPrice ?? 0), 0)

  // ─── レンダリング ──────────────────────────────────────────
  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "8px 12px", fontSize: "12px" }}>

      {/* トップバー */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
        <div style={{ fontSize: "14px", fontWeight: 600, borderLeft: "3px solid #1e3a5f", paddingLeft: "8px" }}>
          {isCopy ? "お見積り複写" : "お見積り入力"}{estimateNo ? " — " + estimateNo : ""}
        </div>
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          <button className="btn-ochi btn-outline" style={{ fontSize: "11px" }} onClick={() => window.location.reload()}>新規</button>
          <button className="btn-ochi btn-green"  style={{ fontSize: "11px" }} onClick={handleSave} disabled={saving}>この見積りを保存</button>
          {draftId && <a href={"/estimates/" + draftId + "/pdf"} target="_blank" className="btn-ochi btn-info" style={{ fontSize: "11px" }}>見積書発行</a>}
          <button className="btn-ochi btn-amber"  style={{ fontSize: "11px" }} onClick={handleOrder} disabled={saving}>この見積りを注文</button>
          <Link href="/dashboard" className="btn-ochi btn-gray" style={{ fontSize: "11px" }}>← メインメニュー</Link>
        </div>
      </div>

      {saveMsg && <div style={{ background: saveMsg.startsWith("✅") ? "#f0fdf4" : "#fee2e2", border: "1px solid " + (saveMsg.startsWith("✅") ? "#86efac" : "#fca5a5"), borderRadius: "4px", padding: "4px 10px", fontSize: "11px", marginBottom: "6px" }}>{saveMsg}</div>}

      {/* ヘッダーテーブル */}
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

      {/* 発送方法 */}
      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderTop: "none", padding: "3px 10px", display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "11px", color: "#64748b" }}>発送方法</span>
        <select id="f-shippingMethod" style={{ ...SEL, width: "100px" }} value={shippingMethod} onChange={e => setShippingMethod(e.target.value)} onKeyDown={onEnter("f-distCode")} {...FH}>
          <option value="delivery">発送</option>
          <option value="direct">直送</option>
        </select>
        <span style={{ fontSize: "11px", color: "#94a3b8" }}>リストよりお選びください</span>
      </div>

      {/* 送り先 */}
      <div style={{ fontSize: "11px", fontWeight: 600, background: "#d8e9f5", color: "#1e3a5f", padding: "3px 8px", borderRadius: "4px 4px 0 0", marginTop: "8px" }}>送り先情報</div>
      <div style={{ border: "1px solid #e2e8f0", borderTop: "none", background: "#fff", padding: "8px 10px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 12px" }}>
        {/* 行1 */}
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <span style={{ fontSize: "10px", color: "#475569", fontWeight: 600, whiteSpace: "nowrap", minWidth: "44px" }}>出荷先</span>
          <input id="f-distCode" style={{ ...INP, width: "70px" }} value={distCode} onChange={e => setDistCode(e.target.value)} onKeyDown={onEnter("f-distName")} {...FH} />
          <button className="btn-ochi btn-info btn-ochi-sm" onClick={() => setShowModal(true)} title="直送先検索">🔍</button>
          <input id="f-distName" style={{ ...INP, flex: 1 }} value={distName} onChange={e => setDistName(e.target.value)} onKeyDown={onEnter("f-distDept")} {...FH} />
        </div>
        <div>
          <div style={{ fontSize: "10px", color: "#475569", fontWeight: 600, marginBottom: "2px" }}>出荷先部署</div>
          <input id="f-distDept" style={INP} value={distDept} onChange={e => setDistDept(e.target.value)} onKeyDown={onEnter("f-distPerson")} {...FH} />
        </div>
        <div style={{ display: "flex", gap: "4px", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "10px", color: "#475569", fontWeight: 600, marginBottom: "2px" }}>ご担当者</div>
            <input id="f-distPerson" style={INP} value={distPerson} onChange={e => setDistPerson(e.target.value)} onKeyDown={onEnter("f-distZip")} {...FH} />
          </div>
          <span style={{ fontSize: "11px", paddingBottom: "3px", color: "#475569" }}>様</span>
        </div>
        {/* 行2 */}
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <span style={{ fontSize: "10px", color: "#475569", fontWeight: 600, whiteSpace: "nowrap", minWidth: "44px" }}>〒</span>
          <input id="f-distZip" style={{ ...INP, width: "80px" }} value={distZip}
            onChange={e => setDistZip(e.target.value)}
            onFocus={onF}
            onBlur={e => { onB(e); handlePostalSearch(e.target.value) }}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handlePostalSearch(distZip); document.getElementById("f-distAddr")?.focus() } }}
            placeholder="0000000" />
        </div>
        <div>
          <div style={{ fontSize: "10px", color: "#475569", fontWeight: 600, marginBottom: "2px" }}>住所</div>
          <input id="f-distAddr" style={INP} value={distAddr} onChange={e => setDistAddr(e.target.value)} onKeyDown={onEnter("f-distTel")} {...FH} />
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "10px", color: "#475569", fontWeight: 600, marginBottom: "2px" }}>TEL</div>
            <input id="f-distTel" style={INP} value={distTel} onChange={e => setDistTel(e.target.value)} onKeyDown={onEnter("f-distFax")} {...FH} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "10px", color: "#475569", fontWeight: 600, marginBottom: "2px" }}>FAX</div>
            <input id="f-distFax" style={INP} value={distFax} onChange={e => setDistFax(e.target.value)} onKeyDown={onEnter("f-contact")} {...FH} />
          </div>
        </div>
        {/* 行3: 通信欄 */}
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontSize: "10px", color: "#475569", fontWeight: 600, marginBottom: "2px" }}>通信欄</div>
          <input id="f-contact" style={INP} value={contact} onChange={e => setContact(e.target.value)} onKeyDown={onEnter("f-mat")} {...FH} />
        </div>
      </div>

      {/* 明細入力 */}
      <div style={{ fontSize: "11px", fontWeight: 600, background: "#d8e9f5", color: "#1e3a5f", padding: "3px 8px", borderRadius: "4px 4px 0 0", marginTop: "8px" }}>見積明細編集</div>
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", minWidth: "900px", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "36px" }} />{/* No */}
            <col style={{ width: "80px" }} />{/* 材料 */}
            <col style={{ width: "40px" }} />{/* 加工T */}
            <col style={{ width: "40px" }} />{/* 加工B */}
            <col style={{ width: "40px" }} />{/* 加工A */}
            <col style={{ width: "80px" }} />{/* 仕上り */}
            <col style={{ width: "55px" }} />{/* 寸法T */}
            <col style={{ width: "60px" }} />{/* 寸法B */}
            <col style={{ width: "65px" }} />{/* 寸法A */}
            <col style={{ width: "44px" }} />{/* 標準 */}
            <col style={{ width: "38px" }} />{/* 公差T */}
            <col style={{ width: "38px" }} />{/* 公差B */}
            <col style={{ width: "38px" }} />{/* 公差A */}
            <col style={{ width: "65px" }} />{/* 面取図 */}
            <col style={{ width: "38px" }} />{/* 4角 */}
            <col style={{ width: "38px" }} />{/* 8辺 */}
            <col style={{ width: "44px" }} />{/* 数量 */}
          </colgroup>
          <thead>
            <tr>
              <th style={TH} rowSpan={2}>No</th>
              <th style={TH} rowSpan={2}>材料</th>
              <th style={TH} colSpan={3}>加工仕様</th>
              <th style={TH} rowSpan={2}>仕上り</th>
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
            {/* 入力行1 */}
            <tr>
              <td style={{ ...TD, textAlign: "center", color: "#94a3b8", fontSize: "10px" }}>—</td>
              <td style={TD}>
                <select id="f-mat" style={SEL} value={form.materialCode}
                  onChange={e => setForm(f => ({ ...f, materialCode: e.target.value, kakouShiyouCode: 0, calculated: false }))}
                  onKeyDown={onEnter("f-cutT")} {...FH}>
                  <option value="">選択</option>
                  {materials.map(m => <option key={m.materialCode} value={m.materialCode}>{m.materialName || m.materialCode}</option>)}
                </select>
              </td>
              <td style={TD}>
                <select id="f-cutT" style={SEL} value={form.kakouShijiCodeT}
                  onChange={e => setForm(f => ({ ...f, kakouShijiCodeT: e.target.value }))}
                  onKeyDown={onEnter("f-cutB")} {...FH}>
                  {cutMethods.length === 0
                    ? <option value="W">W</option>
                    : cutMethods.map(c => <option key={"t-" + c.code} value={String(c.code)}>{c.label}</option>)}
                </select>
              </td>
              <td style={TD}>
                <select id="f-cutB" style={SEL} value={form.kakouShijiCodeB}
                  onChange={e => setForm(f => ({ ...f, kakouShijiCodeB: e.target.value }))}
                  onKeyDown={onEnter("f-cutA")} {...FH}>
                  {cutMethods.length === 0
                    ? <option value="W">W</option>
                    : cutMethods.map(c => <option key={"b-" + c.code} value={String(c.code)}>{c.label}</option>)}
                </select>
              </td>
              <td style={TD}>
                <select id="f-cutA" style={SEL} value={form.kakouShijiCodeA}
                  onChange={e => setForm(f => ({ ...f, kakouShijiCodeA: e.target.value }))}
                  onKeyDown={onEnter("f-shiagari")} {...FH}>
                  {cutMethods.length === 0
                    ? <option value="W">W</option>
                    : cutMethods.map(c => <option key={"a-" + c.code} value={String(c.code)}>{c.label}</option>)}
                </select>
              </td>
              <td style={TD}>
                <select id="f-shiagari" style={SEL} value={form.kakouShiyouCode}
                  onChange={e => setForm(f => ({ ...f, kakouShiyouCode: Number(e.target.value), calculated: false }))}
                  onKeyDown={onEnter("f-sizeT")} {...FH}>
                  <option value={0}>選択</option>
                  {filteredSpecs.map(s => <option key={s.processingSpecCode} value={s.processingSpecCode}>{s.processingSpecName}</option>)}
                </select>
              </td>
              <td style={TD}><input id="f-sizeT" style={{ ...INP, textAlign: "right" }} type="number" step="0.001" value={form.sizeT || ""} onChange={e => setForm(f => ({ ...f, sizeT: parseFloat(e.target.value) || 0, calculated: false }))} onKeyDown={onEnter("f-sizeB")} {...FH} /></td>
              <td style={TD}><input id="f-sizeB" style={{ ...INP, textAlign: "right" }} type="number" step="0.001" value={form.sizeB || ""} onChange={e => setForm(f => ({ ...f, sizeB: parseFloat(e.target.value) || 0 }))} onKeyDown={onEnter("f-sizeA")} {...FH} /></td>
              <td style={TD}><input id="f-sizeA" style={{ ...INP, textAlign: "right" }} type="number" step="0.001" value={form.sizeA || ""} onChange={e => setForm(f => ({ ...f, sizeA: parseFloat(e.target.value) || 0 }))} onKeyDown={onEnter("f-qty")} {...FH} /></td>
              {/* 標準公差ボタン */}
              <td style={{ ...TD, textAlign: "center" }}>
                <button className="btn-ochi btn-outline" style={{ fontSize: "9px", padding: "1px 4px" }} onClick={handleStdTol}>標準</button>
              </td>
              {/* 公差 */}
              <td style={TD}><div style={{ display: "flex", flexDirection: "column", gap: "1px" }}><input style={{ ...INP, height: "11px", fontSize: "9px", textAlign: "right" }} value={form.toleranceTUp || ""} onChange={e => setForm(f => ({ ...f, toleranceTUp: parseFloat(e.target.value) || 0 }))} {...FH} /><input style={{ ...INP, height: "11px", fontSize: "9px", textAlign: "right" }} value={form.toleranceTDown || ""} onChange={e => setForm(f => ({ ...f, toleranceTDown: parseFloat(e.target.value) || 0 }))} {...FH} /></div></td>
              <td style={TD}><div style={{ display: "flex", flexDirection: "column", gap: "1px" }}><input style={{ ...INP, height: "11px", fontSize: "9px", textAlign: "right" }} value={form.toleranceBUp || ""} onChange={e => setForm(f => ({ ...f, toleranceBUp: parseFloat(e.target.value) || 0 }))} {...FH} /><input style={{ ...INP, height: "11px", fontSize: "9px", textAlign: "right" }} value={form.toleranceBDown || ""} onChange={e => setForm(f => ({ ...f, toleranceBDown: parseFloat(e.target.value) || 0 }))} {...FH} /></div></td>
              <td style={TD}><div style={{ display: "flex", flexDirection: "column", gap: "1px" }}><input style={{ ...INP, height: "11px", fontSize: "9px", textAlign: "right" }} value={form.toleranceAUp || ""} onChange={e => setForm(f => ({ ...f, toleranceAUp: parseFloat(e.target.value) || 0 }))} {...FH} /><input style={{ ...INP, height: "11px", fontSize: "9px", textAlign: "right" }} value={form.toleranceADown || ""} onChange={e => setForm(f => ({ ...f, toleranceADown: parseFloat(e.target.value) || 0 }))} {...FH} /></div></td>
              {/* 面取り */}
              <td style={{ ...TD, textAlign: "center" }}>
                <select style={{ ...SEL, fontSize: "9px", height: "20px", marginBottom: "1px" }} value={form.mentoriShiji} onChange={e => setForm(f => ({ ...f, mentoriShiji: parseInt(e.target.value) }))} {...FH}>
                  <option value={1}>面取図参照</option><option value={2}>面取不可</option><option value={9}>---</option>
                </select>
                <button className="btn-ochi btn-outline" style={{ fontSize: "8px", padding: "0 3px", display: "block", width: "100%" }} onClick={handleStdChamfer}>標準</button>
              </td>
              <td style={TD}><input style={{ ...INP, textAlign: "right" }} type="number" step="0.1" value={form.mentori4 || ""} onChange={e => setForm(f => ({ ...f, mentori4: parseFloat(e.target.value) || 0 }))} {...FH} /></td>
              <td style={TD}><input style={{ ...INP, textAlign: "right" }} type="number" step="0.1" value={form.mentori8 || ""} onChange={e => setForm(f => ({ ...f, mentori8: parseFloat(e.target.value) || 0 }))} {...FH} /></td>
              <td style={TD}><input id="f-qty" style={{ ...INP, textAlign: "right" }} type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} onKeyDown={onEnter("f-custDetailNo")} {...FH} /></td>
            </tr>
            {/* 入力行2: 注文番号・備考 */}
            <tr>
              <td colSpan={17} style={TD}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: "180px" }}><span style={{ fontSize: "9px", color: "#64748b" }}>お客様注文番号</span><input id="f-custDetailNo" style={INP} value={form.customerDetailOrderNo} onChange={e => setForm(f => ({ ...f, customerDetailOrderNo: e.target.value }))} onKeyDown={onEnter("f-destDetailNo")} {...FH} /></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: "180px" }}><span style={{ fontSize: "9px", color: "#64748b" }}>送り先注文番号</span><input id="f-destDetailNo" style={INP} value={form.destinationDetailOrderNo} onChange={e => setForm(f => ({ ...f, destinationDetailOrderNo: e.target.value }))} onKeyDown={onEnter("f-remarks")} {...FH} /></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1px", flex: 1 }}><span style={{ fontSize: "9px", color: "#64748b" }}>備考</span><input id="f-remarks" style={INP} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} {...FH} /></div>
                </div>
              </td>
            </tr>
            {/* 入力行3: 計算結果・ボタン */}
            <tr>
              <td colSpan={2} style={{ ...TD, padding: "4px" }}>
                <div style={{ fontSize: "9px", color: "#64748b" }}>最短納期</div>
                <input style={{ ...INP, background: "#f8fafc", color: "#64748b", fontSize: "10px" }} value={fmt(form.fastDeliveryDate)} readOnly />
              </td>
              <td colSpan={6} style={{ ...TD, padding: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <div><div style={{ fontSize: "9px", color: "#64748b" }}>納期保証期限</div><input style={{ ...INP, width: "130px", background: form.fastDeliveryDeadline ? "#ffffcc" : "#fff", borderColor: form.fastDeliveryDeadline ? "#f59e0b" : "#cbd5e1" }} value={fmt(form.fastDeliveryDeadline)} readOnly /></div>
                  <div><div style={{ fontSize: "9px", color: "#64748b" }}>送料込みプレート単価</div><input style={{ ...INP, width: "95px", textAlign: "right", background: "#f8fafc", fontFamily: "monospace" }} value={form.unitPrice != null ? "¥" + form.unitPrice.toLocaleString() : ""} readOnly /></div>
                  <div><div style={{ fontSize: "9px", color: "#64748b" }}>送料込みプレート金額</div><input style={{ ...INP, width: "95px", textAlign: "right", background: "#f8fafc", fontFamily: "monospace" }} value={form.totalPrice != null ? "¥" + form.totalPrice.toLocaleString() : ""} readOnly /></div>
                </div>
              </td>
              <td colSpan={9} style={{ ...TD, textAlign: "right", padding: "4px 8px" }}>
                <div style={{ display: "flex", gap: "5px", justifyContent: "flex-end", alignItems: "flex-start" }}>
                  <button className="btn-ochi btn-blue" style={{ fontSize: "11px" }} onClick={handleCalculate}>🧮 見積計算</button>
                  <div>
                    <button className="btn-ochi btn-green" style={{ fontSize: "11px" }} onClick={handleAdd} disabled={!form.calculated}>＋ 明細に追加</button>
                    {!form.calculated && <div style={{ fontSize: "9px", color: "#d97706", marginTop: "2px" }}>⚠ 先に「見積計算」を実行</div>}
                  </div>
                  <button className="btn-ochi btn-outline" style={{ fontSize: "10px" }} onClick={() => setForm(newForm())}>クリア</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 登録済み明細 */}
      <div style={{ fontSize: "11px", fontWeight: 600, background: "#dcfce7", color: "#166534", padding: "3px 8px", borderRadius: "4px 4px 0 0", marginTop: "8px", display: "flex", justifyContent: "space-between" }}>
        <span>登録済み明細 <span style={{ background: "#86efac", borderRadius: "10px", padding: "1px 7px", fontSize: "10px", marginLeft: "6px" }}>{details.length}件 / 合計 ¥{totalAmt.toLocaleString()}</span></span>
        {selectedIds.size > 0 && <span style={{ fontSize: "10px" }}>選択 {selectedIds.size}件 ¥{selAmt.toLocaleString()}</span>}
      </div>
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 6px 6px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", minWidth: "1000px" }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: "25px" }} rowSpan={3}><input type="checkbox" checked={isAllSel} onChange={e => selAll(e.target.checked)} style={{ width: "12px", height: "12px" }} /></th>
              <th style={{ ...TH, width: "28px" }} rowSpan={3}>No</th>
              <th style={{ ...TH, width: "55px" }} rowSpan={3}>材料</th>
              <th style={TH} colSpan={2}>厚み</th>
              <th style={TH} colSpan={2}>幅</th>
              <th style={TH} colSpan={2}>長さ</th>
              <th style={TH} colSpan={3}>面取り</th>
              <th style={{ ...TH, width: "32px" }} rowSpan={3}>数量</th>
              <th style={{ ...TH, width: "85px" }} rowSpan={3}>納期</th>
              <th style={{ ...TH, width: "70px" }} rowSpan={3}>ご注文番号</th>
              <th style={{ ...TH, textAlign: "right" }} colSpan={2}>プレート金額</th>
              <th style={{ ...TH, width: "36px" }} rowSpan={3}>操作</th>
            </tr>
            <tr>
              <th style={TH}>加工</th><th style={{ ...TH, width: "44px" }}>公差</th>
              <th style={TH}>加工</th><th style={{ ...TH, width: "44px" }}>公差</th>
              <th style={TH}>加工</th><th style={{ ...TH, width: "44px" }}>公差</th>
              <th style={{ ...TH, width: "38px" }}>詳細</th>
              <th style={{ ...TH, width: "30px" }}>4角</th>
              <th style={{ ...TH, width: "30px" }}>8辺</th>
              <th style={{ ...TH, width: "60px", textAlign: "right" }}>単価</th>
              <th style={{ ...TH, width: "65px", textAlign: "right" }}>金額</th>
            </tr>
            <tr>
              <th style={TH}>寸法</th><th style={TH}></th>
              <th style={TH}>寸法</th><th style={TH}></th>
              <th style={TH}>寸法</th><th style={TH}></th>
              <th style={TH}></th><th style={TH}></th><th style={TH}></th>
              <th style={TH}></th><th style={TH}></th>
            </tr>
          </thead>
          <tbody>
            {details.length === 0 ? (
              <tr><td colSpan={18} style={{ ...TD, textAlign: "center", padding: "16px", color: "#94a3b8" }}>明細がありません。上のフォームで入力後「明細に追加」してください。</td></tr>
            ) : details.map((d, i) => {
              const exp = isExpired(d.deliveryDeadline)
              const rs: React.CSSProperties = exp ? { background: "#fee2e2", borderLeft: "3px solid #dc2626" } : {}
              const cm = cutMethods.find(c => String(c.code) === String(d.kakouShijiCodeT))
              return (
                <tr key={d.clientDetailId}>
                  <td style={{ ...TD, ...rs, textAlign: "center" }}><input type="checkbox" checked={selectedIds.has(d.clientDetailId)} onChange={e => selOne(d.clientDetailId, e.target.checked)} style={{ width: "12px", height: "12px" }} /></td>
                  <td style={{ ...TD, ...rs, textAlign: "center" }}>{exp && <span style={{ color: "#dc2626", marginRight: "2px" }}>⚠</span>}{i + 1}</td>
                  <td style={{ ...TD, ...rs }}>{d.materialCode}</td>
                  <td style={{ ...TD, ...rs, textAlign: "center" }}>{d.kakouShijiCodeT || "—"}</td>
                  <td style={{ ...TD, ...rs, textAlign: "right", fontSize: "10px" }}>{d.sizeT}<br /><span style={{ color: "#888" }}>+{d.toleranceTUp}/-{Math.abs(d.toleranceTDown)}</span></td>
                  <td style={{ ...TD, ...rs, textAlign: "center" }}>{d.kakouShijiCodeB || "—"}</td>
                  <td style={{ ...TD, ...rs, textAlign: "right", fontSize: "10px" }}>{d.sizeB}<br /><span style={{ color: "#888" }}>+{d.toleranceBUp}/-{Math.abs(d.toleranceBDown)}</span></td>
                  <td style={{ ...TD, ...rs, textAlign: "center" }}>{d.kakouShijiCodeA || "—"}</td>
                  <td style={{ ...TD, ...rs, textAlign: "right", fontSize: "10px" }}>{d.sizeA}<br /><span style={{ color: "#888" }}>+{d.toleranceAUp}/-{Math.abs(d.toleranceADown)}</span></td>
                  <td style={{ ...TD, ...rs, textAlign: "center", fontSize: "10px" }}>{d.mentoriShiji === 1 ? "図" : d.mentoriShiji === 2 ? "不可" : "---"}</td>
                  <td style={{ ...TD, ...rs, textAlign: "right" }}>{d.mentori4}</td>
                  <td style={{ ...TD, ...rs, textAlign: "right" }}>{d.mentori8}</td>
                  <td style={{ ...TD, ...rs, textAlign: "center" }}>{d.quantity}</td>
                  <td style={{ ...TD, ...rs, fontSize: "10px" }}>
                    <div style={{ color: exp ? "#dc2626" : "#1e293b" }}>{fmt(d.deliveryDate) || "—"}</div>
                    {d.deliveryDeadline && <div style={{ color: "#dc2626", fontWeight: 600 }}>期限:{fmt(d.deliveryDeadline).slice(5)}</div>}
                  </td>
                  <td style={{ ...TD, ...rs, fontSize: "10px" }}>{d.customerDetailOrderNo}</td>
                  <td style={{ ...TD, ...rs, textAlign: "right", fontFamily: "monospace" }}>{d.unitPrice != null ? "¥" + d.unitPrice.toLocaleString() : ""}</td>
                  <td style={{ ...TD, ...rs, textAlign: "right", fontFamily: "monospace" }}>{d.totalPrice != null ? "¥" + d.totalPrice.toLocaleString() : ""}</td>
                  <td style={{ ...TD, ...rs, textAlign: "center" }}><button className="btn-ochi btn-red" style={{ fontSize: "9px", padding: "1px 4px" }} onClick={() => handleDel(d.clientDetailId)}>削除</button></td>
                </tr>
              )
            })}
            {details.length > 0 && (
              <tr>
                <td colSpan={16} style={{ ...TD, textAlign: "right", fontWeight: 600, background: "#f0fdf4", fontSize: "12px" }}>合計金額</td>
                <td style={{ ...TD, textAlign: "right", fontWeight: 700, fontSize: "13px", fontFamily: "monospace", background: "#f0fdf4" }}>¥{totalAmt.toLocaleString()}</td>
                <td style={{ ...TD, background: "#f0fdf4" }}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 直送先検索モーダル */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "60px" }}>
          <div style={{ background: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0", width: "90%", maxWidth: "750px", maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ background: "#1e3a5f", color: "#fff", padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px", fontWeight: 600 }}>
              <span>🔍 直送先検索</span>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: "18px", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                {[["name","直送先名","直送先名を入力"],["address","住所",""],["code","直送先コード",""],["tel","電話番号",""]].map(([k, l, ph]) => (
                  <div key={k}><div style={{ fontSize: "10px", color: "#64748b", marginBottom: "2px" }}>{l}</div><input className="ochi-input" style={INP} value={(mSearch as any)[k]} onChange={e => setMSearch(s => ({ ...s, [k]: e.target.value }))} placeholder={ph} {...FH} /></div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                <button className="btn-ochi btn-blue" onClick={handleMSearch} disabled={mLoading}>🔍 検索</button>
                <button className="btn-ochi btn-outline" onClick={() => setMSearch({ name: "", address: "", code: "", tel: "" })}>クリア</button>
              </div>
            </div>
            <div style={{ overflowY: "auto", padding: "10px" }}>
              {mResults.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                  <thead><tr>{["得意先コード","直送先コード","直送先名","部署名","担当者名","郵便番号","住所","電話番号","選択"].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                  <tbody>
                    {mResults.map((row, idx) => (
                      <tr key={idx}
                        onMouseEnter={e => { Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(c => c.style.background = "#eff6ff") }}
                        onMouseLeave={e => { Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(c => c.style.background = "") }}
                      >
                        <td style={TD}>{row.customerCode}</td>
                        <td style={TD}>{row.deliveryCode ?? row.destinationCode}</td>
                        <td style={TD}>{row.companyName ?? row.destinationName}</td>
                        <td style={TD}>{row.departmentName ?? ""}</td>
                        <td style={TD}>{row.contactPerson ?? row.personName ?? ""}</td>
                        <td style={TD}>{row.postalCode ?? ""}</td>
                        <td style={{ ...TD, fontSize: "10px" }}>{[row.address1, row.address2].filter(Boolean).join(" ") || row.address || ""}</td>
                        <td style={TD}>{row.phoneNumber ?? row.tel ?? ""}</td>
                        <td style={{ ...TD, textAlign: "center" }}><button className="btn-ochi btn-green" style={{ fontSize: "9px", padding: "1px 8px" }} onClick={() => handleMSel(row)}>選択</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8", fontSize: "12px" }}>{mLoading ? "検索中..." : "検索ボタンを押してください"}</div>}
            </div>
            <div style={{ padding: "8px 14px", borderTop: "1px solid #e2e8f0", textAlign: "right" }}>
              <button className="btn-ochi btn-outline" onClick={() => setShowModal(false)}>✕ 閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
