// src/app/api/v1/estimates/[id]/pdf/route.ts
// STEP 21: 見積書PDF出力
// HTML を生成してブラウザに返す (Content-Type: text/html)
// ブラウザの印刷機能で PDF 保存可能。将来 puppeteer 等へ差し替え可能。

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface Props {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Props) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // 見積データ取得
  const estimate = await prisma.estimateHeader.findFirst({
    where: {
      id,
      customerId: session.user.customerId!,
      isDeleted: false,
    },
    include: {
      details: {
        where: { isDeleted: false },
        orderBy: { rowNo: "asc" },
      },
    },
  })

  if (!estimate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const totalAmount = estimate.details.reduce(
    (sum, d) => sum + Number(d.totalPrice ?? 0),
    0
  )

  const detailRows = estimate.details.map((d, i) => {
    const mentori = [
      d.mentori4 ? `4C: ${d.mentori4}` : "",
      d.mentori8 ? `8C: ${d.mentori8}` : "",
    ].filter(Boolean).join(" / ")

    return `
    <tr>
      <td>${i + 1}</td>
      <td>${d.materialCode ?? ""} ${d.materialName ?? ""}</td>
      <td>${d.kakouShiyou ?? ""}</td>
      <td class="right">${d.sizeT ?? ""}</td>
      <td class="right">${d.sizeA ?? ""}</td>
      <td class="right">${d.sizeB ?? ""}</td>
      <td class="right">${d.quantity}</td>
      <td class="right">${d.unitPrice != null ? Number(d.unitPrice).toLocaleString() : "—"}</td>
      <td class="right">${d.totalPrice != null ? Number(d.totalPrice).toLocaleString() : "—"}</td>
      <td>${d.shortestDelivery ?? ""}</td>
    </tr>`
  }).join("")

  const issueDate = new Date().toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric"
  })

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>見積書 ${estimate.estimateNo ?? ""}</title>
<style>
  @page { margin: 15mm; }
  * { box-sizing: border-box; }
  body { font-family: "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif; font-size: 11pt; color: #111; margin: 0; padding: 0; }
  h1 { text-align: center; font-size: 20pt; letter-spacing: 0.3em; border-bottom: 2px solid #1a2744; padding-bottom: 6px; margin-bottom: 16px; }
  .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .block { border: 1px solid #ccc; padding: 8px 12px; border-radius: 4px; }
  .block h3 { font-size: 9pt; color: #666; margin: 0 0 4px 0; }
  .block p { margin: 2px 0; font-size: 10pt; }
  .meta { text-align: right; margin-bottom: 16px; }
  .meta p { margin: 2px 0; font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th { background: #1a2744; color: #fff; padding: 5px 4px; text-align: center; }
  td { padding: 4px; border-bottom: 1px solid #e0e0e0; vertical-align: middle; }
  td.right { text-align: right; }
  tr:nth-child(even) td { background: #f8f9fb; }
  .total-row { font-weight: bold; border-top: 2px solid #1a2744; }
  .total-row td { padding: 6px 4px; }
  .footer { margin-top: 24px; font-size: 9pt; color: #666; border-top: 1px solid #ddd; padding-top: 8px; }
  .print-btn { position: fixed; top: 12px; right: 16px; padding: 8px 16px; background: #1a2744; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; }
  @media print { .print-btn { display: none; } }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨️ 印刷・PDF保存</button>

<h1>見 積 書</h1>

<div class="meta">
  <p>発行日：${issueDate}</p>
  <p>見積番号：<strong>${estimate.estimateNo ?? "（未採番）"}</strong></p>
  <p>有効期限：発行日より30日間</p>
</div>

<div class="header-grid">
  <div class="block">
    <h3>お客様情報</h3>
    <p><strong>${estimate.customerName ?? ""}</strong> 御中</p>
    <p>お客様コード：${estimate.customerCode ?? ""}</p>
    ${estimate.customerOrderNo ? `<p>お客様注文番号：${estimate.customerOrderNo}</p>` : ""}
    ${estimate.endUserNo ? `<p>エンドユーザー番号：${estimate.endUserNo}</p>` : ""}
  </div>
  <div class="block">
    <h3>送り先</h3>
    ${estimate.destinationName ? `<p><strong>${estimate.destinationName}</strong></p>` : "<p>—</p>"}
    ${estimate.destinationDept ? `<p>${estimate.destinationDept}</p>` : ""}
    ${estimate.destinationPerson ? `<p>担当：${estimate.destinationPerson}</p>` : ""}
    ${estimate.destinationZip ? `<p>〒${estimate.destinationZip}</p>` : ""}
    ${estimate.destinationAddress ? `<p>${estimate.destinationAddress}</p>` : ""}
    ${estimate.destinationTel ? `<p>TEL: ${estimate.destinationTel}</p>` : ""}
  </div>
</div>

<p style="text-align:center;margin:12px 0;font-size:11pt;">
  下記の通りお見積り申し上げます。<br>
  <strong>合計金額：¥${totalAmount.toLocaleString()}（税別）</strong>
</p>

<table>
  <thead>
    <tr>
      <th style="width:28px">No</th>
      <th>材料</th>
      <th>加工仕様</th>
      <th style="width:52px">T(mm)</th>
      <th style="width:52px">A(mm)</th>
      <th style="width:52px">B(mm)</th>
      <th style="width:40px">数量</th>
      <th style="width:70px">単価(円)</th>
      <th style="width:80px">金額(円)</th>
      <th style="width:80px">最短納期</th>
    </tr>
  </thead>
  <tbody>
    ${detailRows}
  </tbody>
  <tfoot>
    <tr class="total-row">
      <td colspan="8" style="text-align:right">合計（税別）</td>
      <td class="right">¥${totalAmount.toLocaleString()}</td>
      <td></td>
    </tr>
  </tfoot>
</table>

${estimate.remarks ? `<p style="margin-top:12px;font-size:10pt;"><strong>備考：</strong>${estimate.remarks}</p>` : ""}

<div class="footer">
  <p>越智製作所　TEL: 072-882-5524　E-mail: weborder@ochi-ss.co.jp</p>
  <p>本見積書の有効期限は発行日より30日間です。期限を過ぎた場合は再度お見積りが必要となります。</p>
</div>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
