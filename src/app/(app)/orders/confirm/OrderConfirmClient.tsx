"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface Detail {
  id: string; materialName: string; kakouT: string; kakouB: string; kakouA: string
  sizeT: number; sizeB: number; sizeA: number
  toleranceTUp: number; toleranceTDown: number
  chamfer4C: number; chamfer8C: number
  quantity: number; deliveryDate?: string
  unitPrice: number; totalPrice: number
}
interface Header {
  estimateId: string; estimateNo: string; destinationCode: string
  destinationName: string; userName: string; companyName: string
}
interface Props { header: Header; details: Detail[] }

export default function OrderConfirmClient({ header, details }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  const totalAmount = details.reduce((s, d) => s + d.totalPrice, 0)

  const th: React.CSSProperties = { background: "linear-gradient(to bottom,#f1f5f9,#e2e8f0)", border: "1px solid #cbd5e1", padding: "3px 5px", textAlign: "center", fontWeight: 600, fontSize: "10px", color: "#334155" }
  const td: React.CSSProperties = { border: "1px solid #e2e8f0", padding: "3px 5px", fontSize: "11px", verticalAlign: "middle" }

  const handleConfirm = async () => {
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateId: header.estimateId }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "注文処理に失敗しました") }
      const data = await res.json()
      router.push(`/orders/complete?orderNo=${data.orderNo}&estimateId=${header.estimateId}`)
    } catch (e: any) { setError(e.message); setLoading(false) }
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ fontSize: "14px", fontWeight: 600, borderLeft: "3px solid #1d4ed8", paddingLeft: "8px" }}>注文確認</div>
        <Link href={`/estimates/${header.estimateId}/edit`} className="btn-ochi btn-outline" style={{ fontSize: "11px" }}>← 入力画面へ戻る</Link>
      </div>

      {/* 得意先情報 */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden", marginBottom: "12px" }}>
        <div className="section-title-blue">得意先情報</div>
        <div style={{ padding: "10px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          {[["得意先名", header.companyName], ["担当者名", header.userName], ["見積No", header.estimateNo], ["送り先コード", header.destinationCode], ["送り先名", header.destinationName]].map(([lbl, val]) => (
            <div key={lbl}>
              <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "2px" }}>{lbl}</div>
              <div style={{ fontSize: "12px", fontWeight: 500 }}>{val || "—"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 注文明細テーブル */}
      <div className="section-title-blue" style={{ borderRadius: "4px 4px 0 0", marginBottom: 0 }}>注文明細</div>
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 6px 6px", marginBottom: "14px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", minWidth: "800px" }}>
          <thead>
            <tr>
              <th style={th} rowSpan={2}>No</th>
              <th style={th} rowSpan={2}>材料</th>
              <th style={th} colSpan={2}>厚み</th>
              <th style={th} colSpan={2}>幅</th>
              <th style={th} colSpan={2}>長さ</th>
              <th style={th} colSpan={2}>面取り</th>
              <th style={th} rowSpan={2}>数量</th>
              <th style={th} rowSpan={2}>納期</th>
              <th style={{ ...th, textAlign: "right" }} rowSpan={2}>単価</th>
              <th style={{ ...th, textAlign: "right" }} rowSpan={2}>金額</th>
            </tr>
            <tr>
              <th style={th}>加工</th><th style={th}>公差</th>
              <th style={th}>加工</th><th style={th}>公差</th>
              <th style={th}>加工</th><th style={th}>公差</th>
              <th style={th}>4角</th><th style={th}>8辺</th>
            </tr>
          </thead>
          <tbody>
            {details.map((d, i) => (
              <tr key={d.id}>
                <td style={{ ...td, textAlign: "center" }}>{i+1}</td>
                <td style={td}>{d.materialName}</td>
                <td style={{ ...td, textAlign: "center" }}>{d.kakouT}</td>
                <td style={{ ...td, textAlign: "right", fontSize: "10px" }}>{d.sizeT}<br /><span style={{ color: "#888" }}>+{d.toleranceTUp}/-{Math.abs(d.toleranceTDown)}</span></td>
                <td style={{ ...td, textAlign: "center" }}>{d.kakouB}</td>
                <td style={{ ...td, textAlign: "right" }}>{d.sizeB}</td>
                <td style={{ ...td, textAlign: "center" }}>{d.kakouA}</td>
                <td style={{ ...td, textAlign: "right" }}>{d.sizeA}</td>
                <td style={{ ...td, textAlign: "right" }}>{d.chamfer4C}</td>
                <td style={{ ...td, textAlign: "right" }}>{d.chamfer8C}</td>
                <td style={{ ...td, textAlign: "center" }}>{d.quantity}</td>
                <td style={{ ...td, textAlign: "center", fontSize: "10px" }}>{d.deliveryDate ?? "—"}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>¥{d.unitPrice.toLocaleString()}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>¥{d.totalPrice.toLocaleString()}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={13} style={{ ...td, textAlign: "right", fontWeight: 600, background: "#f0fdf4" }}>ご注文金額合計</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 700, fontSize: "13px", fontFamily: "monospace", background: "#f0fdf4" }}>¥{totalAmount.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {error && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "5px", padding: "8px 12px", fontSize: "12px", color: "#991b1b", marginBottom: "12px" }}>✕ {error}</div>}

      <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
        <Link href={`/estimates/${header.estimateId}/edit`} className="btn-ochi btn-outline" style={{ fontSize: "12px", padding: "8px 20px" }}>← 入力画面へ戻る</Link>
        <button className="btn-ochi btn-amber" style={{ fontSize: "13px", padding: "8px 28px" }} onClick={handleConfirm} disabled={loading}>
          {loading ? "処理中..." : "注文確定"}
        </button>
      </div>
    </div>
  )
}
