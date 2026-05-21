// src/app/(app)/estimates/new/EstimateNewClient.tsx
// 見積入力画面 — ワイヤーフレーム確定版に基づく全面リデザイン
"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"

// ─── 型定義 ───────────────────────────────────────────────────
interface Material    { materialCode: string; materialName: string }
interface ProcSpec    { processingSpecCode: number; processingSpecName: string }
interface CuttingMethod { methodCode: string; methodName: string }
interface UserInfo    { customerId: string; customerCode: string; userName: string; companyName: string }

interface DetailForm {
  clientDetailId: string
  materialCode: string; kakouShiyouCode: number
  kakouT: string; kakouB: string; kakouA: string
  shiagari: string
  sizeT: number; sizeB: number; sizeA: number
  toleranceTUp: number; toleranceTDown: number
  toleranceBUp: number; toleranceBDown: number
  toleranceAUp: number; toleranceADown: number
  mentoriShiji: number
  mentori4: number; mentori8: number
  quantity: number
  customerDetailOrderNo: string; destinationDetailOrderNo: string; remarks: string
  // 計算結果
  unitPrice?: number; totalPrice?: number; deliveryDate?: string
  deliveryDeadline?: string | null
  fastDeliveryDate?: string; fastDeliveryDeadline?: string
  calculated?: boolean
}

interface Props {
  materials: Material[]; processingSpecs: ProcSpec[]; cuttingMethods: CuttingMethod[]
  userInfo: UserInfo; copySource?: any; isCopy?: boolean
}

// ─── ヘルパー ──────────────────────────────────────────────────
function newDetailForm(): DetailForm {
  return {
    clientDetailId: crypto.randomUUID(),
    materialCode: "", kakouShiyouCode: 0,
    kakouT: "", kakouB: "", kakouA: "", shiagari: "",
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

function isExpired(deadline?: string | null): boolean {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

function fmtDate(iso?: string | null): string {
  if (!iso) return ""
  return iso.slice(0, 10)
}

// ─── スタイル定数 ──────────────────────────────────────────────
const TH: React.CSSProperties  = { background: "linear-gradient(to bottom,#f1f5f9,#e2e8f0)", border: "1px solid #cbd5e1", padding: "3px 4px", textAlign: "center", fontWeight: 600, fontSize: "10px", color: "#334155", whiteSpace: "nowrap", verticalAlign: "middle" }
const TD: React.CSSProperties  = { border: "1px solid #e2e8f0", padding: "2px 4px", verticalAlign: "middle", background: "#fff", fontSize: "11px" }
const LBL: React.CSSProperties = { background: "linear-gradient(to right,#f1f5f9,#e8eef4)", fontWeight: 600, color: "#475569", fontSize: "10px", textAlign: "center" as const, whiteSpace: "nowrap" as const, padding: "2px 6px", border: "1px solid #e2e8f0", verticalAlign: "middle" as const }
const INP: React.CSSProperties = { height: "22px", border: "1px solid #cbd5e1", borderRadius: "3px", padding: "0 4px", fontSize: "11px", width: "100%", background: "#fff" }
const SEL: React.CSSProperties = { height: "22px", border: "1px solid #cbd5e1", borderRadius: "3px", padding: "0 2px", fontSize: "11px", width: "100%", background: "#fff" }
const FOCUS_STYLE = { background: "#ffffcc", borderColor: "#f59e0b", outline: "none" }

const focusHandlers = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.background = "#ffffcc"; e.target.style.borderColor = "#f59e0b"; e.target.style.outline = "none" },
  onBlur:  (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.background = "#fff"; e.target.style.borderColor = "#cbd5e1" },
}

// ─── メインコンポーネント ──────────────────────────────────────
export default function EstimateNewClient({ materials, processingSpecs, cuttingMethods, userInfo, copySource, isCopy }: Props) {
  const today = new Date().toISOString().slice(0, 10)

  // ヘッダー
  const [estimateNo,    setEstimateNo]    = useState(isCopy ? "" : (copySource?.estimateNo ?? ""))
  const [orderNo,       setOrderNo]       = useState("")
  const [inputDate,     setInputDate]     = useState(today)
  const [estimateDate,  setEstimateDate]  = useState(today)
  const [shippingMethod, setShippingMethod] = useState(copySource?.shippingMethod ?? "delivery")
  // 送り先
  const [distCode,      setDistCode]     = useState(copySource?.destinationCode ?? "")
  const [distName,      setDistName]     = useState(copySource?.destinationName ?? "")
  const [distDept,      setDistDept]     = useState(copySource?.destinationDept ?? "")
  const [distPerson,    setDistPerson]   = useState(copySource?.destinationPerson ?? "")
  const [distZip,       setDistZip]      = useState(copySource?.destinationZip ?? "")
  const [distAddr,      setDistAddr]     = useState(copySource?.destinationAddress ?? "")
  const [distTel,       setDistTel]      = useState(copySource?.destinationTel ?? "")
  const [distFax,       setDistFax]      = useState(copySource?.destinationFax ?? "")
  const [contact,       setContact]      = useState(copySource?.contact ?? "")
  const [custOrderNo,   setCustOrderNo]  = useState(copySource?.customerOrderNo ?? "")
  const [endUserNo,     setEndUserNo]    = useState(copySource?.endUserNo ?? "")

  // 明細入力フォーム
  const [form, setForm] = useState<DetailForm>(newDetailForm())
  // 登録済み明細
  const [details, setDetails] = useState<DetailForm[]>(copySource?.details ?? [])
  // 直送先検索モーダル
  const [showModal, setShowModal] = useState(false)
  const [modalSearch, setModalSearch] = useState({ name: "", address: "", code: "", tel: "" })
  const [modalResults, setModalResults] = useState<any[]>([])
  const [modalLoading, setModalLoading] = useState(false)
  // 選択行（注文用）
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // 保存状態
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(copySource?.estimateId ?? null)
  // 加工指示マスタ（API取得）
  const [cuttingMethodsState, setCuttingMethodsState] = useState<CuttingMethod[]>(cuttingMethods)
  // 材料×加工仕様マップ
  const [matProcMap, setMatProcMap] = useState<Record<string, number[]>>({})

  const allDetailIds = details.map(d => d.clientDetailId)
  const isAllSelected = allDetailIds.length > 0 && allDetailIds.every(id => selectedIds.has(id))

  // 初期化
  useEffect(() => {
    // 加工指示マスタをAPIから取得
    fetch("/api/v1/cutting-methods?customerCode=" + userInfo.customerCode)
      .then(r => r.json())
      .then(d => { if (d.methods) setCuttingMethodsState(d.methods) })
      .catch(() => {})
  }, [userInfo.customerCode])

  useEffect(() => {
    fetch("/api/v1/masters/material-processing-map")
      .then(r => r.json())
      .then(d => { if (d.map) setMatProcMap(d.map) })
      .catch(() => {})
  }, [])

  const filteredSpecs = matProcMap[form.materialCode]
    ? processingSpecs.filter(s => matProcMap[form.materialCode].includes(s.processingSpecCode))
    : processingSpecs

  // ─── 見積計算 ───────────────────────────────────────────────
  const handleCalculate = async () => {
    if (!form.materialCode || !form.kakouShiyouCode) { alert("材料と加工仕様を選択してください"); return }
    if (!form.sizeT || !form.sizeB || !form.sizeA) { alert("寸法T・B・Aを入力してください"); return }
    try {
      const res = await fetch("/api/v1/estimates/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, customerCode: userInfo.customerCode }),
      })
      if (!res.ok) throw new Error("計算APIエラー")
      const data = await res.json()
      setForm(f => ({
        ...f,
        unitPrice: data.unitPrice, totalPrice: data.totalPrice,
        deliveryDate: data.deliveryDate, deliveryDeadline: data.deliveryDeadline,
        fastDeliveryDate: data.fastDeliveryDate, fastDeliveryDeadline: data.fastDeliveryDeadline,
        calculated: true,
      }))
    } catch (e: any) { alert("見積計算に失敗しました: " + e.message) }
  }

  // ─── 明細追加 ───────────────────────────────────────────────
  const handleAddDetail = () => {
    if (!form.calculated) return
    setDetails(prev => [...prev, { ...form }])
    setForm(newDetailForm())
  }

  // ─── 明細削除 ───────────────────────────────────────────────
  const handleDeleteDetail = (id: string) => {
    setDetails(prev => prev.filter(d => d.clientDetailId !== id))
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  // ─── 全選択 ────────────────────────────────────────────────
  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(allDetailIds))
    else setSelectedIds(new Set())
  }
  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => { const n = new Set(prev); if (checked) n.add(id); else n.delete(id); return n })
  }

  // ─── 保存 ──────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true); setSaveMsg("保存中...")
    try {
      const payload = {
        estimateId: currentDraftId,
        header: { inputDate, estimateDate, shippingMethod, destinationCode: distCode, destinationName: distName, destinationDept: distDept, destinationPerson: distPerson, destinationZip: distZip, destinationAddress: distAddr, destinationTel: distTel, destinationFax: distFax, contact, customerOrderNo: custOrderNo, endUserNo },
        details: details.map((d, i) => ({ ...d, rowNo: i + 1 })),
      }
      const res = await fetch("/api/v1/estimates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error("保存失敗")
      const data = await res.json()
      setCurrentDraftId(data.estimateId)
      setEstimateNo(data.estimateNo ?? "")
      setSaveMsg(`✅ 保存完了！見積番号: ${data.estimateNo}`)
    } catch (e: any) { setSaveMsg("❌ 保存失敗: " + e.message) }
    finally { setSaving(false); setTimeout(() => setSaveMsg(""), 4000) }
  }

  // ─── 注文ボタン ──────────────────────────────────────────────
  const handleOrder = async () => {
    const sel = details.filter(d => selectedIds.has(d.clientDetailId))
    if (sel.length === 0) { alert("注文する明細を選択してください"); return }
    await handleSave()
    if (currentDraftId) window.location.href = `/orders/confirm?estimateId=${currentDraftId}`
  }

  // ─── 直送先検索 ────────────────────────────────────────────
  const handleModalSearch = async () => {
    setModalLoading(true)
    try {
      const q = new URLSearchParams({ name: modalSearch.name, address: modalSearch.address, code: modalSearch.code, tel: modalSearch.tel, customerCode: userInfo.customerCode })
      const res = await fetch("/api/v1/direct-delivery?" + q)
      const data = await res.json()
      setModalResults(data.destinations ?? [])
    } catch { setModalResults([]) }
    finally { setModalLoading(false) }
  }
  const handleModalSelect = (row: any) => {
    setDistCode(row.destinationCode ?? ""); setDistName(row.destinationName ?? "")
    setDistDept(row.departmentName ?? ""); setDistPerson(row.personName ?? "")
    setDistZip(row.postalCode ?? ""); setDistAddr(row.address ?? "")
    setDistTel(row.tel ?? ""); setDistFax(row.fax ?? "")
    setShowModal(false)
  }

  // ─── 標準公差 ─────────────────────────────────────────────
  const handleStdTolerance = async () => {
    try {
      const res = await fetch(`/api/v1/tolerance/standard?kakouShiyouCode=${form.kakouShiyouCode}&sizeT=${form.sizeT}&sizeB=${form.sizeB}&sizeA=${form.sizeA}`)
      const d = await res.json()
      setForm(f => ({ ...f, toleranceTUp: d.tUp ?? 0, toleranceTDown: d.tDown ?? 0, toleranceBUp: d.bUp ?? 0, toleranceBDown: d.bDown ?? 0, toleranceAUp: d.aUp ?? 0, toleranceADown: d.aDown ?? 0 }))
    } catch { /* サイレント */ }
  }
  const handleStdChamfer = async () => {
    try {
      const res = await fetch(`/api/v1/chamfer/standard?kakouShiyouCode=${form.kakouShiyouCode}&sizeT=${form.sizeT}&sizeB=${form.sizeB}&sizeA=${form.sizeA}`)
      const d = await res.json()
      setForm(f => ({ ...f, mentori4: d.chamfer4C ?? 0, mentori8: d.chamfer8C ?? 0 }))
    } catch { /* サイレント */ }
  }

  const totalAmount = details.reduce((s, d) => s + (d.totalPrice ?? 0), 0)
  const selectedTotal = details.filter(d => selectedIds.has(d.clientDetailId)).reduce((s, d) => s + (d.totalPrice ?? 0), 0)

  // ─── レンダリング ─────────────────────────────────────────
  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "10px 12px" }}>
      {/* ─ トップボタンバー ─ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <div style={{ fontSize: "13px", fontWeight: 600, borderLeft: "3px solid #1e3a5f", paddingLeft: "8px" }}>
          {isCopy ? "お見積り複写" : (estimateNo ? `お見積り入力 — ${estimateNo}` : "お見積り入力")}
        </div>
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          <button className="btn-ochi btn-outline" style={{ fontSize: "10px" }} onClick={() => window.location.reload()}>新規</button>
          <button className="btn-ochi btn-green"   style={{ fontSize: "10px" }} onClick={handleSave} disabled={saving}>この見積りを保存</button>
          {currentDraftId && <a href={`/estimates/${currentDraftId}/pdf`} target="_blank" className="btn-ochi btn-info" style={{ fontSize: "10px" }}>見積書発行</a>}
          <button className="btn-ochi btn-amber"   style={{ fontSize: "10px" }} onClick={handleOrder} disabled={saving}>この見積りを注文</button>
          <Link href="/dashboard" className="btn-ochi btn-gray" style={{ fontSize: "10px" }}>← メインメニュー</Link>
        </div>
      </div>

      {saveMsg && <div style={{ background: saveMsg.startsWith("✅") ? "#f0fdf4" : "#fee2e2", border: `1px solid ${saveMsg.startsWith("✅") ? "#86efac" : "#fca5a5"}`, borderRadius: "4px", padding: "5px 10px", fontSize: "11px", marginBottom: "8px" }}>{saveMsg}</div>}

      {/* ─ ヘッダーテーブル ─ */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", marginBottom: "0" }}>
        <tbody>
          <tr>
            <td style={LBL}>見積No</td>
            <td style={{ ...TD, width: "130px" }}><input style={{ ...INP, background: "#f8fafc", color: "#94a3b8" }} value={estimateNo} readOnly /></td>
            <td style={LBL}>注文No</td>
            <td style={{ ...TD, width: "130px" }}><input style={INP} value={orderNo} onChange={e => setOrderNo(e.target.value)} {...focusHandlers} /></td>
            <td style={LBL}>入力日付</td>
            <td style={{ ...TD, width: "120px" }}><input style={INP} type="date" value={inputDate} onChange={e => setInputDate(e.target.value)} {...focusHandlers} /></td>
            <td style={LBL}>見積日付</td>
            <td style={{ ...TD, width: "120px" }}><input style={INP} type="date" value={estimateDate} onChange={e => setEstimateDate(e.target.value)} {...focusHandlers} /></td>
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
      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderTop: "none", padding: "4px 10px", display: "flex", alignItems: "center", gap: "8px", marginBottom: "0" }}>
        <span style={{ fontSize: "10px", color: "#64748b" }}>発送方法</span>
        <select style={{ ...SEL, width: "100px" }} value={shippingMethod} onChange={e => setShippingMethod(e.target.value)} {...focusHandlers}>
          <option value="delivery">発送</option>
          <option value="direct">直送</option>
        </select>
        <span style={{ fontSize: "10px", color: "#94a3b8" }}>リストよりお選びください</span>
      </div>

      {/* ─ 送り先テーブル ─ */}
      <div style={{ fontSize: "11px", fontWeight: 600, background: "#d8e9f5", color: "#1e3a5f", padding: "3px 8px", borderRadius: "4px 4px 0 0", marginTop: "8px" }}>送り先情報</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
        <tbody>
          <tr>
            <td style={LBL}>出荷先</td>
            <td style={{ ...TD, width: "70px" }}><input style={INP} value={distCode} onChange={e => setDistCode(e.target.value)} {...focusHandlers} /></td>
            <td style={{ ...TD, width: "28px", textAlign: "center", padding: "2px" }}>
              <button className="btn-ochi btn-info" style={{ fontSize: "10px", padding: "1px 6px" }} onClick={() => setShowModal(true)}>🔍</button>
            </td>
            <td colSpan={2} style={TD}><input style={INP} value={distName} onChange={e => setDistName(e.target.value)} {...focusHandlers} /></td>
            <td style={LBL}>出荷先部署</td>
            <td colSpan={2} style={TD}><input style={INP} value={distDept} onChange={e => setDistDept(e.target.value)} {...focusHandlers} /></td>
            <td style={LBL}>出荷先ご担当者</td>
            <td colSpan={2} style={TD}><input style={INP} value={distPerson} onChange={e => setDistPerson(e.target.value)} {...focusHandlers} /></td>
            <td style={{ ...TD, width: "16px", fontSize: "10px" }}>様</td>
          </tr>
          <tr>
            <td style={LBL}>出荷先住所</td>
            <td style={{ ...TD, width: "70px" }}><input style={INP} value={distZip} onChange={e => setDistZip(e.target.value)} {...focusHandlers} /></td>
            <td colSpan={5} style={TD}><input style={INP} value={distAddr} onChange={e => setDistAddr(e.target.value)} {...focusHandlers} /></td>
            <td style={LBL}>TEL</td>
            <td colSpan={2} style={TD}><input style={INP} value={distTel} onChange={e => setDistTel(e.target.value)} {...focusHandlers} /></td>
            <td style={LBL}>FAX</td>
            <td style={TD}><input style={INP} value={distFax} onChange={e => setDistFax(e.target.value)} {...focusHandlers} /></td>
          </tr>
          <tr>
            <td style={LBL}>通信欄</td>
            <td colSpan={11} style={TD}><input style={INP} value={contact} onChange={e => setContact(e.target.value)} {...focusHandlers} /></td>
          </tr>
        </tbody>
      </table>

      {/* ─ 明細入力エリア ─ */}
      <div style={{ fontSize: "11px", fontWeight: 600, background: "#d8e9f5", color: "#1e3a5f", padding: "3px 8px", borderRadius: "4px 4px 0 0", marginTop: "10px" }}>見積明細編集</div>
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", minWidth: "900px" }}>
        <thead>
          <tr>
            <th style={TH} rowSpan={2}>No</th>
            <th style={{ ...TH, width: "90px" }} rowSpan={2}>材料</th>
            <th style={TH} colSpan={3}>加工仕様</th>
            <th style={{ ...TH, width: "80px" }} rowSpan={2}>仕上り</th>
            <th style={TH} colSpan={3}>寸法</th>
            <th style={TH} colSpan={4}>公差</th>
            <th style={TH} colSpan={3}>面取り</th>
            <th style={{ ...TH, width: "50px" }} rowSpan={2}>数量</th>
          </tr>
          <tr>
            <th style={{ ...TH, width: "40px" }}>厚み</th><th style={{ ...TH, width: "40px" }}>巾</th><th style={{ ...TH, width: "40px" }}>長さ</th>
            <th style={{ ...TH, width: "55px" }}>厚み</th><th style={{ ...TH, width: "60px" }}>巾</th><th style={{ ...TH, width: "65px" }}>長さ</th>
            <th style={{ ...TH, width: "50px" }}>標準</th><th style={{ ...TH, width: "40px" }}>厚み</th><th style={{ ...TH, width: "40px" }}>巾</th><th style={{ ...TH, width: "40px" }}>長さ</th>
            <th style={{ ...TH, width: "70px" }}>面取図</th><th style={{ ...TH, width: "40px" }}>4角</th><th style={{ ...TH, width: "40px" }}>8辺</th>
          </tr>
        </thead>
        <tbody>
          {/* 入力行1 */}
          <tr>
            <td style={{ ...TD, textAlign: "center", color: "#94a3b8" }}>—</td>
            <td style={TD}>
              <select style={SEL} value={form.materialCode} onChange={e => setForm(f => ({ ...f, materialCode: e.target.value, kakouShiyouCode: 0, calculated: false }))} {...focusHandlers}>
                <option value="">選択</option>
                {materials.map(m => <option key={m.materialCode} value={m.materialCode}>{m.materialCode}</option>)}
              </select>
            </td>
            <td style={TD}><select style={SEL} value={form.kakouT} onChange={e => setForm(f => ({ ...f, kakouT: e.target.value, calculated: false }))} {...focusHandlers}><option value="">—</option>{cuttingMethodsState.map(c => <option key={c.methodCode} value={c.methodCode}>{c.methodCode}</option>)}</select></td>
            <td style={TD}><select style={SEL} value={form.kakouB} onChange={e => setForm(f => ({ ...f, kakouB: e.target.value }))} {...focusHandlers}><option value="">—</option>{cuttingMethodsState.map(c => <option key={c.methodCode} value={c.methodCode}>{c.methodCode}</option>)}</select></td>
            <td style={TD}><select style={SEL} value={form.kakouA} onChange={e => setForm(f => ({ ...f, kakouA: e.target.value }))} {...focusHandlers}><option value="">—</option>{cuttingMethodsState.map(c => <option key={c.methodCode} value={c.methodCode}>{c.methodCode}</option>)}</select></td>
            <td style={TD}>
              <select style={SEL} value={form.kakouShiyouCode} onChange={e => setForm(f => ({ ...f, kakouShiyouCode: Number(e.target.value), calculated: false }))} {...focusHandlers}>
                <option value={0}>選択</option>
                {filteredSpecs.map(s => <option key={s.processingSpecCode} value={s.processingSpecCode}>{s.processingSpecName}</option>)}
              </select>
            </td>
            <td style={TD}><input style={{ ...INP, textAlign: "right" }} type="number" value={form.sizeT || ""} onChange={e => setForm(f => ({ ...f, sizeT: parseFloat(e.target.value) || 0, calculated: false }))} {...focusHandlers} /></td>
            <td style={TD}><input style={{ ...INP, textAlign: "right" }} type="number" value={form.sizeB || ""} onChange={e => setForm(f => ({ ...f, sizeB: parseFloat(e.target.value) || 0 }))} {...focusHandlers} /></td>
            <td style={TD}><input style={{ ...INP, textAlign: "right" }} type="number" value={form.sizeA || ""} onChange={e => setForm(f => ({ ...f, sizeA: parseFloat(e.target.value) || 0 }))} {...focusHandlers} /></td>
            {/* 公差 標準ボタン */}
            <td style={{ ...TD, textAlign: "center" }}><button className="btn-ochi btn-outline" style={{ fontSize: "9px", padding: "1px 5px" }} onClick={handleStdTolerance}>標準</button></td>
            {/* 公差 厚み */}
            <td style={TD}><div style={{ display: "flex", flexDirection: "column", gap: "1px" }}><input style={{ ...INP, height: "11px", fontSize: "9px", textAlign: "right" }} placeholder="+0" value={form.toleranceTUp || ""} onChange={e => setForm(f => ({ ...f, toleranceTUp: parseFloat(e.target.value) || 0 }))} {...focusHandlers} /><input style={{ ...INP, height: "11px", fontSize: "9px", textAlign: "right" }} placeholder="-0" value={form.toleranceTDown || ""} onChange={e => setForm(f => ({ ...f, toleranceTDown: parseFloat(e.target.value) || 0 }))} {...focusHandlers} /></div></td>
            <td style={TD}><div style={{ display: "flex", flexDirection: "column", gap: "1px" }}><input style={{ ...INP, height: "11px", fontSize: "9px", textAlign: "right" }} placeholder="+0" value={form.toleranceBUp || ""} onChange={e => setForm(f => ({ ...f, toleranceBUp: parseFloat(e.target.value) || 0 }))} {...focusHandlers} /><input style={{ ...INP, height: "11px", fontSize: "9px", textAlign: "right" }} placeholder="-0" value={form.toleranceBDown || ""} onChange={e => setForm(f => ({ ...f, toleranceBDown: parseFloat(e.target.value) || 0 }))} {...focusHandlers} /></div></td>
            <td style={TD}><div style={{ display: "flex", flexDirection: "column", gap: "1px" }}><input style={{ ...INP, height: "11px", fontSize: "9px", textAlign: "right" }} placeholder="+0" value={form.toleranceAUp || ""} onChange={e => setForm(f => ({ ...f, toleranceAUp: parseFloat(e.target.value) || 0 }))} {...focusHandlers} /><input style={{ ...INP, height: "11px", fontSize: "9px", textAlign: "right" }} placeholder="-0" value={form.toleranceADown || ""} onChange={e => setForm(f => ({ ...f, toleranceADown: parseFloat(e.target.value) || 0 }))} {...focusHandlers} /></div></td>
            {/* 面取り */}
            <td style={{ ...TD, textAlign: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                <select style={{ ...SEL, fontSize: "9px", height: "20px" }} value={form.mentoriShiji} onChange={e => setForm(f => ({ ...f, mentoriShiji: parseInt(e.target.value) }))} {...focusHandlers}>
                  <option value={1}>面取図参照</option><option value={2}>面取不可</option><option value={9}>---</option>
                </select>
                <button className="btn-ochi btn-outline" style={{ fontSize: "8px", padding: "1px 4px" }} onClick={handleStdChamfer}>標準</button>
              </div>
            </td>
            <td style={TD}><input style={{ ...INP, textAlign: "right" }} type="number" value={form.mentori4 || ""} onChange={e => setForm(f => ({ ...f, mentori4: parseFloat(e.target.value) || 0 }))} {...focusHandlers} /></td>
            <td style={TD}><input style={{ ...INP, textAlign: "right" }} type="number" value={form.mentori8 || ""} onChange={e => setForm(f => ({ ...f, mentori8: parseFloat(e.target.value) || 0 }))} {...focusHandlers} /></td>
            <td style={TD}><input style={{ ...INP, textAlign: "right" }} type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} {...focusHandlers} /></td>
          </tr>
          {/* 入力行2: お客様注文番号等 */}
          <tr>
            <td colSpan={17} style={TD}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: "180px" }}><span style={{ fontSize: "9px", color: "#64748b" }}>お客様注文番号</span><input style={INP} value={form.customerDetailOrderNo} onChange={e => setForm(f => ({ ...f, customerDetailOrderNo: e.target.value }))} {...focusHandlers} /></div>
                <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: "180px" }}><span style={{ fontSize: "9px", color: "#64748b" }}>送り先注文番号</span><input style={INP} value={form.destinationDetailOrderNo} onChange={e => setForm(f => ({ ...f, destinationDetailOrderNo: e.target.value }))} {...focusHandlers} /></div>
                <div style={{ display: "flex", flexDirection: "column", gap: "1px", flex: 1 }}><span style={{ fontSize: "9px", color: "#64748b" }}>備考</span><input style={INP} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} {...focusHandlers} /></div>
              </div>
            </td>
          </tr>
          {/* 入力行3: 計算結果・ボタン */}
          <tr>
            <td colSpan={2} style={{ ...TD, padding: "4px" }}>
              <div style={{ fontSize: "9px", color: "#64748b" }}>最短納期</div>
              <input style={{ ...INP, background: "#f8fafc", color: "#64748b", fontSize: "10px" }} value={form.fastDeliveryDate ?? ""} readOnly />
            </td>
            <td colSpan={6} style={{ ...TD, padding: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "9px", color: "#64748b" }}>納期保証期限</div>
                  <input style={{ ...INP, width: "130px", background: form.fastDeliveryDeadline ? "#ffffcc" : "#fff", borderColor: form.fastDeliveryDeadline ? "#f59e0b" : "#cbd5e1" }} value={form.fastDeliveryDeadline ? fmtDate(form.fastDeliveryDeadline) : ""} readOnly />
                </div>
                <div>
                  <div style={{ fontSize: "9px", color: "#64748b" }}>送料込みプレート単価</div>
                  <input style={{ ...INP, width: "100px", textAlign: "right", background: "#f8fafc", fontFamily: "monospace" }} value={form.unitPrice != null ? `¥${form.unitPrice.toLocaleString()}` : ""} readOnly />
                </div>
                <div>
                  <div style={{ fontSize: "9px", color: "#64748b" }}>送料込みプレート金額</div>
                  <input style={{ ...INP, width: "100px", textAlign: "right", background: "#f8fafc", fontFamily: "monospace" }} value={form.totalPrice != null ? `¥${form.totalPrice.toLocaleString()}` : ""} readOnly />
                </div>
              </div>
            </td>
            <td colSpan={9} style={{ ...TD, textAlign: "right", padding: "4px 8px" }}>
              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                <button className="btn-ochi btn-blue" style={{ fontSize: "11px" }} onClick={handleCalculate}>🧮 見積計算</button>
                <div>
                  <button className="btn-ochi btn-green" style={{ fontSize: "11px" }} onClick={handleAddDetail} disabled={!form.calculated}>＋ 明細に追加</button>
                  {!form.calculated && <div style={{ fontSize: "9px", color: "#d97706", marginTop: "2px" }}>⚠ 先に「見積計算」を実行してください</div>}
                </div>
                <button className="btn-ochi btn-outline" style={{ fontSize: "10px" }} onClick={() => setForm(newDetailForm())}>クリア</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>

      {/* ─ 登録済み明細 ─ */}
      <div style={{ fontSize: "11px", fontWeight: 600, background: "#dcfce7", color: "#166534", padding: "3px 8px", borderRadius: "4px 4px 0 0", marginTop: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>登録済み明細 <span style={{ background: "#86efac", color: "#166534", borderRadius: "10px", padding: "1px 7px", fontSize: "10px", marginLeft: "6px" }}>{details.length}件 / 合計 ¥{totalAmount.toLocaleString()}</span></span>
        {selectedIds.size > 0 && <span style={{ fontSize: "10px" }}>選択中 {selectedIds.size}件 ¥{selectedTotal.toLocaleString()}</span>}
      </div>
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 6px 6px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", minWidth: "1000px" }}>
        <thead>
          <tr>
            <th style={{ ...TH, width: "25px" }}><input type="checkbox" checked={isAllSelected} onChange={e => handleSelectAll(e.target.checked)} style={{ width: "12px", height: "12px" }} /></th>
            <th style={{ ...TH, width: "25px" }} rowSpan={3}>No</th>
            <th style={{ ...TH, width: "60px" }} rowSpan={3}>材料</th>
            <th style={TH} colSpan={2}>厚み</th>
            <th style={TH} colSpan={2}>幅</th>
            <th style={TH} colSpan={2}>長さ</th>
            <th style={TH} colSpan={3}>面取り</th>
            <th style={{ ...TH, width: "35px" }} rowSpan={3}>数量</th>
            <th style={{ ...TH, width: "90px" }} rowSpan={3}>納期</th>
            <th style={{ ...TH, width: "75px" }} rowSpan={3}>ご注文番号</th>
            <th style={TH} colSpan={2}>プレート金額</th>
            <th style={{ ...TH, width: "38px" }} rowSpan={3}>操作</th>
          </tr>
          <tr>
            <th style={TH} rowSpan={2}>加工</th><th style={{ ...TH, width: "45px" }} rowSpan={2}>公差</th>
            <th style={TH} rowSpan={2}>加工</th><th style={{ ...TH, width: "45px" }} rowSpan={2}>公差</th>
            <th style={TH} rowSpan={2}>加工</th><th style={{ ...TH, width: "45px" }} rowSpan={2}>公差</th>
            <th style={{ ...TH, width: "40px" }} rowSpan={2}>詳細</th>
            <th style={{ ...TH, width: "32px" }} rowSpan={2}>4角</th>
            <th style={{ ...TH, width: "32px" }} rowSpan={2}>8辺</th>
            <th style={{ ...TH, width: "65px", textAlign: "right" }} rowSpan={2}>単価</th>
            <th style={{ ...TH, width: "70px", textAlign: "right" }} rowSpan={2}>金額</th>
          </tr>
          <tr><th style={{ ...TH, width: "25px" }}><input type="checkbox" checked={isAllSelected} onChange={e => handleSelectAll(e.target.checked)} style={{ width: "12px", height: "12px" }} /></th></tr>
        </thead>
        <tbody>
          {details.length === 0 ? (
            <tr><td colSpan={17} style={{ ...TD, textAlign: "center", padding: "16px", color: "#94a3b8" }}>明細がありません。上のフォームで入力後「明細に追加」してください。</td></tr>
          ) : details.map((d, i) => {
            const expired = isExpired(d.deliveryDeadline)
            const rowStyle: React.CSSProperties = expired ? { background: "#fee2e2", borderLeft: "3px solid #dc2626" } : {}
            return (
              <tr key={d.clientDetailId}>
                <td style={{ ...TD, ...rowStyle, textAlign: "center" }}><input type="checkbox" checked={selectedIds.has(d.clientDetailId)} onChange={e => handleSelectOne(d.clientDetailId, e.target.checked)} style={{ width: "12px", height: "12px" }} /></td>
                <td style={{ ...TD, ...rowStyle, textAlign: "center" }}>{expired && <span style={{ color: "#dc2626", marginRight: "2px" }}>⚠</span>}{i+1}</td>
                <td style={{ ...TD, ...rowStyle }}>{d.materialCode}</td>
                <td style={{ ...TD, ...rowStyle, textAlign: "center" }}>{d.kakouT || "—"}</td>
                <td style={{ ...TD, ...rowStyle, textAlign: "right", fontSize: "9px" }}>{d.sizeT}<br /><span style={{ color: "#888" }}>+{d.toleranceTUp}/-{Math.abs(d.toleranceTDown)}</span></td>
                <td style={{ ...TD, ...rowStyle, textAlign: "center" }}>{d.kakouB || "—"}</td>
                <td style={{ ...TD, ...rowStyle, textAlign: "right", fontSize: "9px" }}>{d.sizeB}<br /><span style={{ color: "#888" }}>+{d.toleranceBUp}/-{Math.abs(d.toleranceBDown)}</span></td>
                <td style={{ ...TD, ...rowStyle, textAlign: "center" }}>{d.kakouA || "—"}</td>
                <td style={{ ...TD, ...rowStyle, textAlign: "right", fontSize: "9px" }}>{d.sizeA}<br /><span style={{ color: "#888" }}>+{d.toleranceAUp}/-{Math.abs(d.toleranceADown)}</span></td>
                <td style={{ ...TD, ...rowStyle, textAlign: "center", fontSize: "9px" }}>{d.mentoriShiji === 1 ? "図参照" : d.mentoriShiji === 2 ? "不可" : "---"}</td>
                <td style={{ ...TD, ...rowStyle, textAlign: "right" }}>{d.mentori4}</td>
                <td style={{ ...TD, ...rowStyle, textAlign: "right" }}>{d.mentori8}</td>
                <td style={{ ...TD, ...rowStyle, textAlign: "center" }}>{d.quantity}</td>
                <td style={{ ...TD, ...rowStyle, fontSize: "9px" }}>
                  <div style={{ color: expired ? "#dc2626" : "#1e293b" }}>{d.deliveryDate ?? "—"}</div>
                  {d.deliveryDeadline && <div style={{ color: "#dc2626", fontWeight: 600 }}>期限: {fmtDate(d.deliveryDeadline).slice(5)}</div>}
                </td>
                <td style={{ ...TD, ...rowStyle, fontSize: "9px" }}>{d.customerDetailOrderNo}</td>
                <td style={{ ...TD, ...rowStyle, textAlign: "right", fontFamily: "monospace" }}>{d.unitPrice != null ? `¥${d.unitPrice.toLocaleString()}` : ""}</td>
                <td style={{ ...TD, ...rowStyle, textAlign: "right", fontFamily: "monospace" }}>{d.totalPrice != null ? `¥${d.totalPrice.toLocaleString()}` : ""}</td>
                <td style={{ ...TD, ...rowStyle, textAlign: "center" }}>
                  <button className="btn-ochi btn-red" style={{ fontSize: "9px", padding: "1px 5px" }} onClick={() => handleDeleteDetail(d.clientDetailId)}>削除</button>
                </td>
              </tr>
            )
          })}
          {details.length > 0 && (
            <tr>
              <td colSpan={16} style={{ ...TD, textAlign: "right", fontWeight: 600, background: "#f0fdf4", fontSize: "11px" }}>合計金額</td>
              <td style={{ ...TD, textAlign: "right", fontWeight: 700, fontSize: "12px", fontFamily: "monospace", background: "#f0fdf4" }}>¥{totalAmount.toLocaleString()}</td>
              <td style={{ ...TD, background: "#f0fdf4" }}></td>
            </tr>
          )}
        </tbody>
      </table>
      </div>

      {/* ─ 直送先検索モーダル ─ */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "60px" }}>
          <div style={{ background: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0", width: "90%", maxWidth: "750px", maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ background: "#1e3a5f", color: "#fff", padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", fontWeight: 600 }}>
              <span>🔍 直送先検索</span>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: "16px", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: "14px", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                <div><div style={{ fontSize: "10px", color: "#64748b", marginBottom: "2px" }}>直送先名</div><input className="ochi-input" style={INP} value={modalSearch.name} onChange={e => setModalSearch(s => ({ ...s, name: e.target.value }))} placeholder="直送先名を入力" {...focusHandlers} /></div>
                <div><div style={{ fontSize: "10px", color: "#64748b", marginBottom: "2px" }}>住所</div><input className="ochi-input" style={INP} value={modalSearch.address} onChange={e => setModalSearch(s => ({ ...s, address: e.target.value }))} {...focusHandlers} /></div>
                <div><div style={{ fontSize: "10px", color: "#64748b", marginBottom: "2px" }}>直送先コード</div><input className="ochi-input" style={INP} value={modalSearch.code} onChange={e => setModalSearch(s => ({ ...s, code: e.target.value }))} {...focusHandlers} /></div>
                <div><div style={{ fontSize: "10px", color: "#64748b", marginBottom: "2px" }}>電話番号</div><input className="ochi-input" style={INP} value={modalSearch.tel} onChange={e => setModalSearch(s => ({ ...s, tel: e.target.value }))} {...focusHandlers} /></div>
              </div>
              <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                <button className="btn-ochi btn-blue" onClick={handleModalSearch} disabled={modalLoading}>🔍 検索</button>
                <button className="btn-ochi btn-outline" onClick={() => setModalSearch({ name: "", address: "", code: "", tel: "" })}>クリア</button>
              </div>
            </div>
            <div style={{ overflowY: "auto", padding: "10px" }}>
              {modalResults.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
                  <thead>
                    <tr>
                      {["得意先コード","直送先コード","直送先名","部署名","担当者名","郵便番号","住所","電話番号","選択"].map(h => (
                        <th key={h} style={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modalResults.map(row => (
                      <tr key={row.id}
                        onMouseEnter={e => { Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(c => c.style.background = "#eff6ff") }}
                        onMouseLeave={e => { Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(c => c.style.background = "") }}
                      >
                        <td style={TD}>{row.customerCode}</td>
                        <td style={TD}>{row.destinationCode}</td>
                        <td style={TD}>{row.destinationName}</td>
                        <td style={TD}>{row.departmentName ?? ""}</td>
                        <td style={TD}>{row.personName ?? ""}</td>
                        <td style={TD}>{row.postalCode ?? ""}</td>
                        <td style={{ ...TD, fontSize: "9px" }}>{row.address ?? ""}</td>
                        <td style={TD}>{row.tel ?? ""}</td>
                        <td style={{ ...TD, textAlign: "center" }}><button className="btn-ochi btn-green" style={{ fontSize: "9px", padding: "1px 8px" }} onClick={() => handleModalSelect(row)}>選択</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8", fontSize: "12px" }}>{modalLoading ? "検索中..." : "検索ボタンを押してください"}</div>}
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
