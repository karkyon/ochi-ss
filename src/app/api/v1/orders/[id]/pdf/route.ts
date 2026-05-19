// GET /api/v1/orders/[id]/pdf — 注文書HTML出力
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const { id } = await params
  const order = await prisma.order.findFirst({
    where: { id, customerId: session.user.customerId! },
    include: {
      estimateHeader: {
        include: {
          details: { where: { isDeleted: false }, orderBy: { rowNo: "asc" } }
        }
      }
    },
  })
  if (!order) return new NextResponse("Not Found", { status: 404 })

  const estimate = order.estimateHeader as any
  const details  = estimate?.details ?? []
  const orderDate = order.orderDate
    ? new Date(order.orderDate).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })
    : "—"
  const totalAmount = details.reduce((s: number, d: any) => s + Number(d.totalPrice ?? 0), 0)

  const detailRows = details.map((d: any, i: number) => `
    <tr>
      <td>${i + 1}</td>
      <td>${d.materialName ?? d.materialCode ?? ""}</td>
      <td>${d.kakouShiyou ?? ""}</td>
      <td class="num">${Number(d.sizeT)}×${Number(d.sizeA)}×${Number(d.sizeB)}</td>
      <td class="num">${d.quantity ?? ""}</td>
      <td class="num">¥${Number(d.unitPrice ?? 0).toLocaleString()}</td>
      <td class="num">¥${Number(d.totalPrice ?? 0).toLocaleString()}</td>
      <td>${d.shortestDelivery ?? "—"}</td>
    </tr>`).join("")

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>注文書 ${order.orderNo ?? ""}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; padding: 20mm; }
    @media print { body { padding: 10mm; } .no-print { display: none !important; } @page { size: A4; margin: 10mm; } }
    .no-print { text-align: center; padding: 16px; margin-bottom: 20px; }
    .no-print button { padding: 10px 28px; font-size: 14px; background: #1a2744; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    h1 { font-size: 24px; text-align: center; letter-spacing: 4px; margin-bottom: 20px; border-bottom: 3px double #1a2744; padding-bottom: 10px; }
    .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .info-block { border: 1px solid #ddd; border-radius: 4px; padding: 12px; }
    .info-block h3 { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px; }
    .info-row .label { color: #666; flex-shrink: 0; margin-right: 8px; }
    .info-row .value { font-weight: 500; text-align: right; }
    .destination { border: 2px solid #1a2744; border-radius: 4px; padding: 12px; margin-bottom: 20px; }
    .destination .company { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
    th { background: #1a2744; color: #fff; padding: 6px 8px; text-align: left; font-weight: 500; white-space: nowrap; }
    td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: middle; }
    tr:nth-child(even) td { background: #f8f9fb; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .total-row td { font-weight: bold; font-size: 13px; border-top: 2px solid #1a2744; background: #f0f4ff !important; }
    .footer { margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .company-info .name { font-size: 16px; font-weight: bold; color: #1a2744; margin-bottom: 6px; }
    .sign-area { display: flex; gap: 8px; justify-content: flex-end; }
    .sign-box { width: 60px; height: 60px; border: 1px solid #999; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #999; }
  </style>
</head>
<body>
  <div class="no-print"><button onclick="window.print()">🖨️ PDF印刷 / 保存</button></div>
  <h1>注　文　書</h1>

  <div class="header-grid">
    <div>
      <div class="destination">
        <div class="company">${estimate?.destinationName ?? "—"}&ensp;御中</div>
        ${estimate?.destinationDept ? `<div style="font-size:13px;color:#444">${estimate.destinationDept}</div>` : ""}
        ${estimate?.destinationAddress ? `<div style="font-size:11px;color:#666">〒${estimate?.destinationZip ?? ""} ${estimate.destinationAddress}</div>` : ""}
      </div>
      <div style="font-size:18px;font-weight:bold;color:#1a2744;margin-bottom:4px;">
        合計金額：¥${totalAmount.toLocaleString()}（税抜）
      </div>
    </div>
    <div class="info-block">
      <h3>注文情報</h3>
      <div class="info-row"><span class="label">注文No</span><span class="value">${order.orderNo ?? "—"}</span></div>
      <div class="info-row"><span class="label">注文日</span><span class="value">${orderDate}</span></div>
      <div class="info-row"><span class="label">見積No</span><span class="value">${estimate?.estimateNo ?? "—"}</span></div>
      <div class="info-row"><span class="label">お客様注文No</span><span class="value">${estimate?.customerOrderNo ?? "—"}</span></div>
      <div class="info-row"><span class="label">注文状況</span><span class="value">${order.orderStatus ?? "—"}</span></div>
      <div style="margin-top:12px;"><div class="sign-area">
        <div class="sign-box">確認</div>
        <div class="sign-box">担当</div>
      </div></div>
    </div>
  </div>

  <table>
    <thead><tr>
      <th style="width:3%">No</th>
      <th style="width:12%">材料</th>
      <th style="width:10%">加工仕様</th>
      <th style="width:15%">寸法T×A×B</th>
      <th style="width:6%">数量</th>
      <th style="width:10%">単価</th>
      <th style="width:11%">金額</th>
      <th style="width:10%">最短納期</th>
    </tr></thead>
    <tbody>${detailRows}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="6" class="num">合　計（税抜）</td>
        <td class="num">¥${totalAmount.toLocaleString()}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <div class="company-info" style="font-size:11px">
      <div class="name">越智製作所</div>
      <div>〒577-0802 大阪府東大阪市小若江3-4-1</div>
      <div>TEL：072-882-5524　FAX：072-882-5527</div>
      <div>E-mail：weborder@ochi-ss.co.jp</div>
    </div>
    <div class="info-block" style="font-size:11px">
      <h3>お支払条件</h3>
      <div>月末締め翌月末払い</div>
      <div style="margin-top:8px;color:#666;font-size:10px">
        ※ 価格は税抜きです（消費税は別途申し受けます）
      </div>
    </div>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  })
}
