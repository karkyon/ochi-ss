"use client"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { useState } from "react"

interface Order {
  id: string; orderNo: string; orderDate: string
  estimateNo: string; destinationName: string
  totalAmount: number; status: string
}
interface Props {
  defaultValues: Record<string, string>
  orders: Order[]; total: number; page: number; totalPages: number
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  processing: { label: "処理中", cls: "badge-blue" },
  shipped:    { label: "出荷済", cls: "badge-green" },
  completed:  { label: "完了",   cls: "badge-amber" },
  cancelled:  { label: "取消",   cls: "badge-red"   },
}

export default function OrdersClient({ defaultValues, orders, total, page, totalPages }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [form, setForm] = useState(defaultValues)

  const go = (override?: Record<string, string>) => {
    const p = { ...form, ...override, page: "1" }
    router.push(pathname + "?" + Object.entries(p).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&"))
  }

  const th: React.CSSProperties = { background: "linear-gradient(to bottom,#f1f5f9,#e2e8f0)", border: "1px solid #cbd5e1", padding: "4px 6px", textAlign: "center", fontWeight: 600, fontSize: "10px", color: "#334155", whiteSpace: "nowrap" }
  const td: React.CSSProperties = { border: "1px solid #e2e8f0", padding: "4px 6px", fontSize: "11px", verticalAlign: "middle" }
  const inp: React.CSSProperties = { height: "26px", border: "1px solid #cbd5e1", borderRadius: "3px", padding: "0 6px", fontSize: "11px", background: "#fff", width: "100%" }

  return (
    <>
      <div className="search-section">
        <div className="search-title">検索条件</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px", marginBottom: "8px" }}>
          {[["dateFrom","注文日付 From","date"],["dateTo","注文日付 To","date"],["orderNo","お客様注文No","text"]].map(([k, l, t]) => (
            <div key={k}>
              <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "2px" }}>{l}</div>
              <input className="ochi-input" type={t} value={form[k] ?? ""} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={inp} />
            </div>
          ))}
          <div>
            <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "2px" }}>注文状況</div>
            <select className="ochi-select" value={form.status ?? ""} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ ...inp, paddingRight: "4px" }}>
              <option value="">全て</option>
              <option value="processing">処理中</option>
              <option value="shipped">出荷済</option>
              <option value="completed">完了</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button className="btn-ochi btn-blue" onClick={() => go()}>検索</button>
          <button className="btn-ochi btn-outline" onClick={() => { setForm({}); router.push(pathname) }}>クリア</button>
        </div>
      </div>

      <div className="result-bar">検索結果: {total}件</div>
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "6px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
          <thead>
            <tr>
              <th style={th}>注文No</th>
              <th style={th}>注文日付</th>
              <th style={th}>見積No</th>
              <th style={th}>送り先名</th>
              <th style={{ ...th, textAlign: "right" }}>注文合計額</th>
              <th style={th}>状況</th>
              <th style={th}>詳細</th>
              <th style={th}>注文書PDF</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={8} style={{ ...td, textAlign: "center", padding: "24px", color: "#94a3b8" }}>データがありません</td></tr>
            ) : orders.map(o => {
              const st = STATUS_BADGE[o.status] ?? { label: o.status, cls: "badge-gray" }
              return (
                <tr key={o.id}
                  onMouseEnter={e => { Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(c => c.style.background = "#eff6ff") }}
                  onMouseLeave={e => { Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(c => c.style.background = "") }}
                >
                  <td style={{ ...td, color: "#1d4ed8", fontWeight: 500 }}>{o.orderNo}</td>
                  <td style={{ ...td, textAlign: "center" }}>{o.orderDate}</td>
                  <td style={td}>{o.estimateNo}</td>
                  <td style={td}>{o.destinationName}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>¥{o.totalAmount.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: "center" }}><span className={st.cls}>{st.label}</span></td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <Link href={`/orders/${o.id}`} className="btn-ochi btn-outline" style={{ fontSize: "10px", padding: "2px 8px" }}>詳細</Link>
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <a href={`/orders/${o.id}/pdf`} target="_blank" className="btn-ochi btn-info" style={{ fontSize: "10px", padding: "2px 8px" }}>PDF</a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", marginTop: "12px", fontSize: "11px", color: "#64748b" }}>
        <button className="btn-ochi btn-outline" style={{ fontSize: "10px" }} disabled={page <= 1} onClick={() => go({ page: String(page - 1) })}>◀ 前</button>
        <span>{page} / {totalPages} ページ（全{total}件）</span>
        <button className="btn-ochi btn-outline" style={{ fontSize: "10px" }} disabled={page >= totalPages} onClick={() => go({ page: String(page + 1) })}>次 ▶</button>
      </div>
    </>
  )
}
