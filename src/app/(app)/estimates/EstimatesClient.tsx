// src/app/(app)/estimates/EstimatesClient.tsx
"use client"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { useState } from "react"

interface Estimate {
  id: string; estimateNo: string; estimateDate: string
  destinationName: string; destinationAddress: string
  estimateStatus: string; isDraftOnly: boolean
  customerOrderNo: string; detailCount: number; totalAmount: number
}
interface Props {
  defaultValues: Record<string, string>
  estimates: Estimate[]; total: number; page: number; totalPages: number; perPage: number
  statusLabelMap: Record<string, { label: string; color: string }>
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft:     { label: "下書き",   cls: "badge-gray" },
  confirmed: { label: "確定済",   cls: "badge-blue" },
  ordered:   { label: "注文済",   cls: "badge-green" },
  completed: { label: "完了",     cls: "badge-amber" },
}

export default function EstimatesClient({ defaultValues, estimates, total, page, totalPages }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [form, setForm] = useState(defaultValues)

  const buildQuery = (override?: Record<string, string>) => {
    const p = { ...form, ...override, page: "1" }
    return "?" + Object.entries(p).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")
  }
  const go = (override?: Record<string, string>) => router.push(pathname + buildQuery(override))
  const setDate = (preset: string) => {
    const now = new Date()
    let from = "", to = now.toISOString().slice(0, 10)
    if (preset === "today") { from = to }
    else if (preset === "week") { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); from = d.toISOString().slice(0, 10) }
    else if (preset === "month") { from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01` }
    else if (preset === "quarter") { const q = Math.floor(now.getMonth()/3); from = `${now.getFullYear()}-${String(q*3+1).padStart(2,"0")}-01` }
    else if (preset === "year") { from = `${now.getFullYear()}-01-01` }
    setForm(f => ({ ...f, dateFrom: from, dateTo: to }))
  }

  const th: React.CSSProperties = { background: "linear-gradient(to bottom,#f1f5f9,#e2e8f0)", border: "1px solid #cbd5e1", padding: "4px 6px", textAlign: "center", fontWeight: 600, fontSize: "10px", color: "#334155", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 10 }
  const td: React.CSSProperties = { border: "1px solid #e2e8f0", padding: "4px 6px", fontSize: "11px", verticalAlign: "middle" }

  const inp: React.CSSProperties = { height: "26px", border: "1px solid #cbd5e1", borderRadius: "3px", padding: "0 6px", fontSize: "11px", background: "#fff", width: "100%" }

  return (
    <>
      {/* 検索セクション */}
      <div className="search-section">
        <div className="search-title">検索条件</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px", marginBottom: "8px" }}>
          {[["dateFrom","見積日付 From","date"],["dateTo","見積日付 To","date"],["noFrom","見積No From","text"],["noTo","見積No To","text"]].map(([key, lbl, type]) => (
            <div key={key}>
              <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "2px" }}>{lbl}</div>
              <input className="ochi-input" type={type} value={form[key] ?? ""} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={inp} />
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "8px", marginBottom: "8px" }}>
          <div>
            <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "2px" }}>出荷先会社名</div>
            <input className="ochi-input" value={form.destName ?? ""} onChange={e => setForm(f => ({ ...f, destName: e.target.value }))} placeholder="部分一致" style={inp} />
          </div>
          <div>
            <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "2px" }}>お客様注文No</div>
            <input className="ochi-input" value={form.orderNo ?? ""} onChange={e => setForm(f => ({ ...f, orderNo: e.target.value }))} style={inp} />
          </div>
          <div style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
            <button className="btn-ochi btn-blue" onClick={() => go()}>検索</button>
            <button className="btn-ochi btn-outline" onClick={() => { setForm({}); router.push(pathname) }}>クリア</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {[["today","今日"],["week","今週"],["month","今月"],["quarter","今四半期"],["year","今年"]].map(([k, l]) => (
            <button key={k} className="btn-ochi btn-outline" style={{ fontSize: "10px", padding: "2px 8px" }} onClick={() => setDate(k)}>{l}</button>
          ))}
        </div>
      </div>

      {/* 結果バー */}
      <div className="result-bar">
        検索結果: {total}件 &nbsp;
        <span style={{ fontSize: "10px", color: "#166534" }}>ダブルクリックで編集画面に移動します</span>
      </div>

      {/* テーブル */}
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "6px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", minWidth: "900px" }}>
          <thead>
            <tr>
              <th style={th}>見積No</th>
              <th style={th}>見積日付</th>
              <th style={th}>お客様注文No</th>
              <th style={th}>出荷先名</th>
              <th style={th}>出荷先住所</th>
              <th style={{ ...th, textAlign: "right" }}>見積合計額</th>
              <th style={th}>明細件数</th>
              <th style={th}>状況</th>
              <th style={th}>編集</th>
              <th style={th}>コピー</th>
              <th style={th}>見積書</th>
            </tr>
          </thead>
          <tbody>
            {estimates.length === 0 ? (
              <tr><td colSpan={11} style={{ ...td, textAlign: "center", padding: "24px", color: "#94a3b8" }}>データがありません</td></tr>
            ) : estimates.map(est => {
              const st = STATUS_BADGE[est.estimateStatus] ?? { label: est.estimateStatus, cls: "badge-gray" }
              return (
                <tr key={est.id} style={{ cursor: "pointer" }}
                  onDoubleClick={() => router.push(`/estimates/${est.id}/edit`)}
                  onMouseEnter={e => { Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(c => c.style.background = "#eff6ff") }}
                  onMouseLeave={e => { Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(c => c.style.background = "") }}
                >
                  <td style={{ ...td, color: "#1d4ed8", fontWeight: 500 }}>{est.estimateNo || "—"}</td>
                  <td style={{ ...td, textAlign: "center" }}>{est.estimateDate || "—"}</td>
                  <td style={td}>{est.customerOrderNo || ""}</td>
                  <td style={td}>{est.destinationName}</td>
                  <td style={{ ...td, fontSize: "10px" }}>{est.destinationAddress}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>¥{est.totalAmount.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: "center" }}>{est.detailCount}件</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <span className={st.cls}>{st.label}</span>
                    {est.isDraftOnly && <><br /><span className="badge-amber">下書き中</span></>}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <Link href={`/estimates/${est.id}/edit`} className="btn-ochi btn-blue" style={{ fontSize: "10px", padding: "2px 8px" }}>編集</Link>
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <Link href={`/estimates/new?copyFrom=${est.id}`} className="btn-ochi btn-outline" style={{ fontSize: "10px", padding: "2px 8px" }}>コピー</Link>
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <a href={`/estimates/${est.id}/pdf`} target="_blank" className="btn-ochi btn-info" style={{ fontSize: "10px", padding: "2px 8px" }}>見積書</a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", marginTop: "12px", fontSize: "11px", color: "#64748b" }}>
        <button className="btn-ochi btn-outline" style={{ fontSize: "10px" }} disabled={page <= 1} onClick={() => go({ page: String(page - 1) })}>◀ 前</button>
        <span>{page} / {totalPages} ページ（全{total}件）</span>
        <button className="btn-ochi btn-outline" style={{ fontSize: "10px" }} disabled={page >= totalPages} onClick={() => go({ page: String(page + 1) })}>次 ▶</button>
      </div>
    </>
  )
}
