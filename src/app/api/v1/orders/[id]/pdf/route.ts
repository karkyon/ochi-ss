// GET /api/v1/orders/[id]/pdf — 注文書PDF (HTML形式)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface Props { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Props) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const order = await prisma.order.findFirst({
    where: { id, customerId: session.user.customerId!, isDeleted: false },
    include: {
      estimateHeader: {
        include: { details: { where: { isDeleted: false }, orderBy: { rowNo: "asc" } } },
      },
    },
  })
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const est = order.estimateHeader
  const totalAmount = Number(order.totalAmount ?? est.details.reduce((s, d) => s + Number(d.totalPrice ?? 0), 0))
  const issueDate = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })

  const detailRows = est.details.map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${d.materialCode} ${d.materialName ?? ""}</td>
      <td>${d.kakouShiyou ?? ""}</td>
      <td class="right">${Number(d.sizeT)}</td>
      <td class="right">${Number(d.sizeA)}</td>
      <td class="right">${Number(d.sizeB)}</td>
      <td class="right">${d.quantity}</td>
      <td class="right">${d.unitPrice != null ? Number(d.unitPrice).toLocaleString() : "—"}</td>
      <td class="right">${d.totalPrice != null ? Number(d.totalPrice).toLocaleString() : "—"}</td>
      <td>${d.shortestDelivery ?? ""}</td>
    </tr>`).join("")

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>注文書 ${order.orderNo ?? ""}</title>
<style>
  @page { margin: 15mm; }
  * { box-sizing: border-box; }
  body { font-family: "Hiragino Kaku Gothic ProN","Meiryo",sans-serif; font-size: 11pt; color: #111; margin: 0; }
  h1 { text-align: center; font-size: 20pt; letter-spacing: 0.3em; border-bottom: 2px solid #1a2744; padding-bottom: 6px; margin-bottom: 16px; }
  .meta { text-align: right; margin-bottom: 12px; }
  .meta p { margin: 2px 0; font-size: 10pt; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .block { border: 1px solid #ccc; padding: 8px 12px; border-radius: 4px; }
  .block h3 { font-size: 9pt; color: #666; margin: 0 0 4px; }
  .block p { margin: 2px 0; font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th { background: #1a2744; color: #fff; padding: 5px 4px; text-align: center; }
  td { padding: 4px; border-bottom: 1px solid #e0e0e0; vertical-align: middle; }
  td.right { text-align: right; }
  tr:nth-child(even) td { background: #f8f9fb; }
  .total-row td { font-weight: bold; border-top: 2px solid #1a2744; padding: 6px 4px; }
  .footer { margin-top: 24px; font-size: 9pt; color: #666; border-top: 1px solid #ddd; padding-top: 8px; }
  .print-btn { position: fixed; top: 12px; right: 16px; padding: 8px 16px; background: #1a2744; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; }
  @media print { .print-btn { display: none; } }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨️ 印刷・PDF保存</button>
<h1>注 文 書</h1>
<div class="meta">
  <p>発行日：${issueDate}</p>
  <p>注文番号：<strong>${order.orderNo ?? "（採番待ち）"}</strong></p>
  <p>見積番号：${est.estimateNo ?? "—"}</p>
</div>
<div class="grid">
  <div class="block">
    <h3>注文者</h3>
    <p><strong>${est.customerName}</strong></p>
    <p>得意先コード：${est.customerCode}</p>
    ${est.customerOrderNo ? `<p>お客様注文番号：${est.customerOrderNo}</p>` : ""}
  </div>
  <div class="block">
    <h3>送り先</h3>
    ${est.destinationName ? `<p><strong>${est.destinationName}</strong></p>` : "<p>—</p>"}
    ${est.destinationDept ? `<p>${est.destinationDept}</p>` : ""}
    ${est.destinationZip ? `<p>〒${est.destinationZip}</p>` : ""}
    ${est.destinationAddress ? `<p>${est.destinationAddress}</p>` : ""}
    ${est.destinationTel ? `<p>TEL: ${est.destinationTel}</p>` : ""}
  </div>
</div>
<p style="text-align:center;margin:12px 0;font-size:11pt;">
  <strong>注文合計金額：¥${totalAmount.toLocaleString()}（税別）</strong>
</p>
<table>
  <thead>
    <tr>
      <th style="width:28px">No</th><th>材料</th><th>加工仕様</th>
      <th style="width:52px">T</th><th style="width:52px">A</th><th style="width:52px">B</th>
      <th style="width:40px">数量</th><th style="width:70px">単価(円)</th>
      <th style="width:80px">金額(円)</th><th style="width:80px">最短納期</th>
    </tr>
  </thead>
  <tbody>${detailRows}</tbody>
  <tfoot>
    <tr class="total-row">
      <td colspan="8" style="text-align:right">合計（税別）</td>
      <td class="right">¥${totalAmount.toLocaleString()}</td><td></td>
    </tr>
  </tfoot>
</table>
${est.remarks ? `<p style="margin-top:12px;font-size:10pt;"><strong>備考：</strong>${est.remarks}</p>` : ""}
<div class="footer">
  <p>越智製作所　TEL: 072-882-5524　E-mail: weborder@ochi-ss.co.jp</p>
</div>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  })
}
