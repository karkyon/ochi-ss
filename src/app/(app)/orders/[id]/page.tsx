// src/app/(app)/orders/[id]/page.tsx
// 2026/07/16 デザイン統一: 見積入力画面(EstimateNewClient.tsx)と同じ
// デザイントークン(btn-ochiボタン・TH/TD/LBLテーブルスタイル・ネイビー基調)に
// 全面刷新し、見積画面⇄注文詳細画面の行き来で統一感のないUIになっていた問題を解消。
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import OrderCancelButton from "./OrderCancelButton"

const STATUS_LABEL: Record<string, string> = {
  pending: "処理中", confirmed: "確定", in_progress: "製造中",
  shipped: "出荷済", completed: "完了", cancelled: "取消",
}

// ─── スタイル定数（見積入力画面(EstimateNewClient.tsx)と統一） ───
const TH: React.CSSProperties = {
  background: "#1e3a5f", color: "#fff", fontSize: "12px", fontWeight: 600,
  padding: "5px 6px", textAlign: "center", border: "1px solid #334155", whiteSpace: "nowrap",
}
const TD: React.CSSProperties = {
  border: "1px solid #e2e8f0", padding: "5px 8px", verticalAlign: "middle",
}
const LBL: React.CSSProperties = {
  background: "#e8edf5", fontSize: "12px", fontWeight: 600, color: "#374151",
  padding: "5px 8px", border: "1px solid #d1d5db", whiteSpace: "nowrap",
}
const VAL: React.CSSProperties = {
  fontSize: "13px", color: "#1e293b", fontWeight: 500,
}
const SECTION_TITLE: React.CSSProperties = {
  background: "#d8e9f5", color: "#1e3a5f", fontSize: "12px", fontWeight: 700,
  padding: "5px 10px", borderRadius: "4px 4px 0 0", border: "1px solid #b3d4ed", borderBottom: "none",
}
const CARD: React.CSSProperties = {
  border: "1px solid #e2e8f0", borderRadius: "0 0 6px 6px", marginBottom: "14px", overflow: "hidden",
}

interface Props { params: Promise<{ id: string }> }

export default async function OrderDetailPage({ params }: Props) {
  const session = await auth()
  const { id } = await params

  const order = await (prisma as any).order.findFirst({
    where: { id, customerId: session!.user.customerId!, isDeleted: false },
    include: {
      estimateHeader: {
        include: {
          details: { where: { isDeleted: false }, orderBy: { rowNo: "asc" } },
        },
      },
      statusHistories: { orderBy: { occurredAt: "asc" } },
      // ★2026/07/13 修正: Prismaスキーマ上の実際のリレーション名は specChanges
      // (specChangeHistories という名前のフィールドは存在せず
      //  PrismaClientValidationErrorの原因になっていた)
      specChanges:     { orderBy: { occurredAt: "asc" } },
    },
  })

  if (!order) notFound()

  const est         = order.estimateHeader
  // ★重大バグ修正(2026/07/15): est.detailsは見積ヘッダー配下の全明細(他の
  // 部分注文・未注文分も含む)であり、この注文に属する明細だけに絞り込まないと
  // 「別の注文の明細まで表示される/合計と明細一覧が食い違う」事故になる。
  const orderDetails = (est.details as any[]).filter((d: any) => d.orderId === order.id)
  const totalAmount = Number(order.totalAmount ?? 0)
  const statusLabel = STATUS_LABEL[order.orderStatus] ?? order.orderStatus ?? "—"

  // 公差フォーマットヘルパー（見積書PDFと同一ロジック）
  const fmtKousa = (upper: any, lower: any) => {
    if (upper == null && lower == null) return "—"
    const u = upper != null ? `+${Number(upper)}` : ""
    const l = lower != null ? `-${Number(lower)}` : ""
    return u && l ? `${u}/${l}` : u || l
  }
  // 面取指示: 未入力・0のときは「0C」を表示しない
  const fmtMentori = (v: any) => (v != null && Number(v) > 0 ? `${Number(v)}C` : "—")

  return (
    <div style={{ fontSize: "13px", padding: "4px 8px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* ─── ヘッダーボタン(見積入力画面と統一) ─── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontWeight: 700, fontSize: "15px", color: "#1e3a5f" }}>注文詳細</span>
          {order.orderNo && <span style={{ fontSize: "12px", color: "#64748b" }}>（注文No: {order.orderNo}）</span>}
          <span style={{
            display: "inline-block", fontSize: "11px", fontWeight: 700, padding: "2px 10px",
            borderRadius: "999px", background: "#e0e7ff", color: "#3730a3",
          }}>{statusLabel}</span>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <Link href="/orders">
            <button className="btn-ochi btn-outline" style={{ fontSize: "13px" }}>← 注文一覧</button>
          </Link>
          <a href={`/api/v1/orders/${order.id}/pdf`} target="_blank" rel="noopener noreferrer"
            className="btn-ochi btn-outline" style={{ fontSize: "13px", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            📄 注文書PDF
          </a>
          {["pending", "confirmed"].includes(order.orderStatus) && (
            <OrderCancelButton orderId={order.id} orderNo={order.orderNo ?? order.id.slice(0, 8)} />
          )}
          <Link href="/dashboard">
            <button className="btn-ochi btn-outline" style={{ fontSize: "13px" }}>← メインメニュー</button>
          </Link>
        </div>
      </div>

      {/* ─── 注文情報 ─── */}
      <div style={SECTION_TITLE}>注文情報</div>
      <div style={CARD}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <tbody>
            <tr>
              <td style={LBL}>注文No</td>
              <td style={TD}><span style={VAL}>{order.orderNo ?? "（採番待ち）"}</span></td>
              <td style={LBL}>注文日付</td>
              <td style={TD}><span style={VAL}>{new Date(order.orderDate).toLocaleDateString("ja-JP")}</span></td>
              <td style={LBL}>見積No</td>
              <td style={TD}><span style={VAL}>{est.estimateNo ?? "—"}</span></td>
            </tr>
            <tr>
              <td style={LBL}>得意先コード</td>
              <td style={TD}><span style={VAL}>{est.customerCode}</span></td>
              <td style={LBL}>得意先名</td>
              <td style={TD} colSpan={3}><span style={VAL}>{est.customerName}</span></td>
            </tr>
            <tr>
              <td style={LBL}>お客様注文番号</td>
              <td style={TD}><span style={VAL}>{est.customerOrderNo ?? "—"}</span></td>
              <td style={LBL}>合計金額（税別）</td>
              <td style={TD}><span style={{ ...VAL, fontWeight: 700, color: "#1e3a5f" }}>{totalAmount > 0 ? `¥${totalAmount.toLocaleString()}` : "—"}</span></td>
              <td style={LBL}>明細件数</td>
              <td style={TD}><span style={VAL}>{order.detailCount ?? orderDetails.length}件</span></td>
            </tr>
            {order.trackingNo && (
              <tr>
                <td style={LBL}>送り状番号</td>
                <td style={TD} colSpan={5}><span style={VAL}>{order.trackingNo}</span></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── 送り先情報 ─── */}
      {est.destinationName && (
        <>
          <div style={SECTION_TITLE}>送り先情報</div>
          <div style={CARD}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <tbody>
                <tr>
                  <td style={LBL}>送り先コード</td>
                  <td style={TD}><span style={VAL}>{est.destinationCode ?? "—"}</span></td>
                  <td style={LBL}>送り先名称</td>
                  <td style={TD} colSpan={3}><span style={VAL}>{est.destinationName}</span></td>
                </tr>
                <tr>
                  <td style={LBL}>部署名</td>
                  <td style={TD}><span style={VAL}>{est.destinationDept ?? "—"}</span></td>
                  <td style={LBL}>担当者名</td>
                  <td style={TD} colSpan={3}><span style={VAL}>{est.destinationPerson ?? "—"}</span></td>
                </tr>
                <tr>
                  <td style={LBL}>郵便番号</td>
                  <td style={TD}><span style={VAL}>{est.destinationZip ? `〒${est.destinationZip}` : "—"}</span></td>
                  <td style={LBL}>住所</td>
                  <td style={TD} colSpan={3}><span style={VAL}>{est.destinationAddress ?? "—"}</span></td>
                </tr>
                <tr>
                  <td style={LBL}>TEL</td>
                  <td style={TD}><span style={VAL}>{est.destinationTel ?? "—"}</span></td>
                  <td style={LBL}>FAX</td>
                  <td style={TD} colSpan={3}><span style={VAL}>{est.destinationFax ?? "—"}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ─── 注文明細 ─── */}
      <div style={SECTION_TITLE}>注文明細</div>
      <div style={{ ...CARD, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: "3%" }}>No</th>
              <th style={{ ...TH, width: "10%" }}>材質</th>
              <th style={{ ...TH, width: "12%" }}>仕上り表示記号<br />（加工仕様・指示）</th>
              <th style={{ ...TH, width: "20%" }}>寸法(厚みT×長さB×幅A)<br />及び公差</th>
              <th style={{ ...TH, width: "8%" }}>面取指示<br />(4C/8C)</th>
              <th style={{ ...TH, width: "5%" }}>数量</th>
              <th style={{ ...TH, width: "9%" }}>単価</th>
              <th style={{ ...TH, width: "9%" }}>金額</th>
              <th style={{ ...TH, width: "9%" }}>最短納期</th>
            </tr>
          </thead>
          <tbody>
            {orderDetails.map((d: any, i: number) => (
              <tr key={d.id} style={{ background: i % 2 === 1 ? "#f8fafc" : "#fff" }}>
                <td style={{ ...TD, textAlign: "center" }}>{i + 1}</td>
                <td style={TD}>
                  <div style={{ fontWeight: 600, color: "#1e293b" }}>{d.materialName ?? d.materialCode ?? "—"}</div>
                </td>
                <td style={TD}>
                  <div style={{ fontWeight: 600, color: "#1e293b" }}>{d.kakouShiyou ?? "—"}</div>
                  <div style={{ fontSize: "9px", color: "#64748b", marginTop: "2px" }}>T:{d.kakouT ?? "-"} A:{d.kakouA ?? "-"} B:{d.kakouB ?? "-"}</div>
                </td>
                <td style={{ ...TD, textAlign: "center" }}>
                  <div style={{ fontWeight: 600, color: "#1e293b" }}>{Number(d.sizeT)}×{Number(d.sizeB)}×{Number(d.sizeA)}</div>
                  <div style={{ fontSize: "9px", color: "#64748b", marginTop: "2px" }}>
                    T {fmtKousa(d.kousaTUpper, d.kousaTLower)} / A {fmtKousa(d.kousaAUpper, d.kousaALower)} / B {fmtKousa(d.kousaBUpper, d.kousaBLower)}
                  </div>
                </td>
                <td style={{ ...TD, textAlign: "right", fontSize: "10px", color: "#475569" }}>{fmtMentori(d.mentori4)} / {fmtMentori(d.mentori8)}</td>
                <td style={{ ...TD, textAlign: "right" }}>{d.quantity ?? ""}</td>
                <td style={{ ...TD, textAlign: "right" }}>{d.unitPrice != null ? `¥${Number(d.unitPrice).toLocaleString()}` : "—"}</td>
                <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: "#1e3a5f" }}>{d.totalPrice != null ? `¥${Number(d.totalPrice).toLocaleString()}` : "—"}</td>
                <td style={{ ...TD, fontSize: "10px", color: "#475569" }}>{d.shortestDelivery ?? "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7} style={{ ...TD, textAlign: "right", fontWeight: 700, color: "#374151", background: "#f1f5f9" }}>合　計（税別）</td>
              <td style={{ ...TD, textAlign: "right", fontWeight: 700, fontSize: "13px", color: "#1e3a5f", background: "#f1f5f9" }}>
                {totalAmount > 0 ? `¥${totalAmount.toLocaleString()}` : "—"}
              </td>
              <td style={{ ...TD, background: "#f1f5f9" }} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ─── ステータス変更履歴 ─── */}
      {order.statusHistories?.length > 0 && (
        <>
          <div style={SECTION_TITLE}>ステータス変更履歴</div>
          <div style={{ ...CARD, padding: "10px 12px" }}>
            {order.statusHistories.map((h: any) => {
              const toLabel = STATUS_LABEL[h.toStatus] ?? h.toStatus
              return (
                <div key={h.id} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", padding: "3px 0" }}>
                  <span style={{ color: "#94a3b8", fontSize: "11px", whiteSpace: "nowrap" }}>{new Date(h.occurredAt).toLocaleDateString("ja-JP")}</span>
                  <span style={{ display: "inline-block", fontSize: "11px", fontWeight: 700, padding: "1px 8px", borderRadius: "999px", background: "#e0e7ff", color: "#3730a3" }}>{toLabel}</span>
                  {h.changeReason && <span style={{ color: "#64748b" }}>{h.changeReason}</span>}
                  {h.trackingNo && <span style={{ color: "#64748b" }}>送り状: {h.trackingNo}</span>}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ─── 仕様変更履歴 ─── */}
      {order.specChanges?.length > 0 && (
        <>
          <div style={{ ...SECTION_TITLE, background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" }}>⚠️ 仕様変更履歴</div>
          <div style={{ ...CARD, borderColor: "#fde68a", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
              <thead>
                <tr>
                  {["行No", "変更フィールド", "変更前", "変更後", "変更理由", "変更日時"].map(h => (
                    <th key={h} style={{ ...TH, background: "#fde68a", color: "#92400e", border: "1px solid #fcd34d" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.specChanges.map((h: any) => (
                  <tr key={h.id}>
                    <td style={{ ...TD, textAlign: "center" }}>{h.rowNo}</td>
                    <td style={{ ...TD, fontFamily: "monospace" }}>{h.fieldName}</td>
                    <td style={{ ...TD, color: "#94a3b8", textDecoration: "line-through" }}>{h.oldValue ?? "—"}</td>
                    <td style={{ ...TD, fontWeight: 600, color: "#92400e" }}>{h.newValue}</td>
                    <td style={TD}>{h.changeReason ?? "—"}</td>
                    <td style={{ ...TD, color: "#94a3b8", whiteSpace: "nowrap" }}>
                      {h.occurredAt ? new Date(h.occurredAt).toLocaleDateString("ja-JP") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ─── 備考 ─── */}
      {est.remarks && (
        <>
          <div style={SECTION_TITLE}>備考</div>
          <div style={{ ...CARD, padding: "10px 12px", fontSize: "12px", color: "#334155" }}>{est.remarks}</div>
        </>
      )}

      {/* ─── お問い合わせ ─── */}
      <div style={{
        background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px",
        padding: "10px 14px", fontSize: "12px", color: "#334155", marginBottom: "20px",
      }}>
        <div style={{ fontWeight: 700, color: "#1e3a5f", marginBottom: "2px" }}>ご不明な点はお問い合わせください</div>
        <div>越智製作所　TEL: 072-882-5524　E-mail: weborder@ochi-ss.co.jp</div>
      </div>
    </div>
  )
}
