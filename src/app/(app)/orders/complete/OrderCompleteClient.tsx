"use client"
import Link from "next/link"

interface Props {
  orderNo: string; orderDate: string; processTime: string
  totalAmount: number; detailCount: number; estimateNo?: string
}

export default function OrderCompleteClient({ orderNo, orderDate, processTime, totalAmount, detailCount, estimateNo }: Props) {
  const cell: React.CSSProperties = { border: "1px solid #e2e8f0", padding: "5px 10px", fontSize: "11px" }
  const lbl: React.CSSProperties  = { ...cell, background: "linear-gradient(to right,#f1f5f9,#e8eef4)", fontWeight: 600, color: "#475569", width: "120px" }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <div style={{ fontSize: "40px", marginBottom: "8px" }}>✅</div>
        <div style={{ fontSize: "20px", fontWeight: 700, color: "#166534" }}>ご注文ありがとうございました</div>
      </div>

      {/* 注文完了情報 */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", overflow: "hidden", marginBottom: "16px" }}>
        <div className="section-title-blue">注文完了情報</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr><td style={lbl}>注文番号</td><td style={{ ...cell, fontWeight: 600, fontFamily: "monospace" }}>{orderNo}</td><td style={lbl}>注文日</td><td style={cell}>{orderDate}</td></tr>
            <tr><td style={lbl}>処理時刻</td><td style={cell}>{processTime}</td><td style={lbl}>処理ステータス</td><td style={cell}><span className="badge-green">正常完了</span></td></tr>
            <tr><td style={lbl}>ご注文金額合計</td><td style={{ ...cell, fontWeight: 600 }}>¥{totalAmount.toLocaleString()}</td><td style={lbl}>明細件数</td><td style={cell}>{detailCount}件</td></tr>
          </tbody>
        </table>
      </div>

      {/* ボタン */}
      <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginBottom: "20px" }}>
        {estimateNo && (
          <a href={`/estimates/${estimateNo}/pdf`} target="_blank" className="btn-ochi btn-info" style={{ fontSize: "12px", padding: "6px 16px" }}>📄 注文内容控えを出力</a>
        )}
        <Link href="/dashboard" className="btn-ochi btn-navy" style={{ fontSize: "12px", padding: "6px 16px" }}>← メインメニューへ</Link>
      </div>

      {/* お礼メッセージ */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "20px", textAlign: "center" }}>
        <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "8px" }}>ご利用ありがとうございます</div>
        <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "12px" }}>ご注文を正常に受け付けました</div>
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "12px", fontSize: "11px", color: "#475569", lineHeight: "1.8" }}>
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>株式会社越智製作所</div>
          <div>販売促進部：TEL: 072-882-5524 / FAX: 072-882-5590</div>
          <div>メール: weborder@ochi-ss.co.jp</div>
        </div>
        <div style={{ marginTop: "12px", fontSize: "11px", color: "#94a3b8" }}>このご注文に対するお問い合わせの際は、上記の注文番号でお問い合わせください</div>
      </div>
    </div>
  )
}
