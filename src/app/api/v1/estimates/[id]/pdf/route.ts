// GET /api/v1/estimates/[id]/pdf — 見積書HTML出力
// 2026/07/13 デザイン刷新: 業務システムの正式帳票（お見積回答書）レイアウトを
// 踏襲しつつ、注文確認画面と統一感のあるモダンなカード/テーブル意匠を採用。
import { NextRequest, NextResponse } from "next/server"
import { getTenantCtx } from "@/lib/tenant-guard"
import { withTenant } from "@/lib/with-tenant"
import { audit } from "@/lib/audit-log"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await getTenantCtx()
  if (error) return new NextResponse("Unauthorized", { status: 401 })
  const { id } = await params
  const estimate = await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {
    return (tx as any).estimateHeader.findFirst({
      where: { id, customerId: ctx.customerId, isDeleted: false },
      include: {
        details: {
          where: { isDeleted: false },
          orderBy: { rowNo: "asc" },
        },
      },
    })
  }) as any
  if (!estimate) return new NextResponse("Not Found", { status: 404 })

  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "EXPORT", resource: "pdf", resourceId: id, req })

  const issueDate = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })
  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })

  const details = (estimate.details as any[]) ?? []
  const subtotal = details.reduce((s, d) => s + Number(d.totalPrice ?? 0), 0)
  const taxRate = 0.10
  const tax = Math.round(subtotal * taxRate)
  const grandTotal = subtotal + tax

  // 公差フォーマットヘルパー（+上限/-下限）
  const fmtKousa = (upper: any, lower: any) => {
    if (upper == null && lower == null) return "—"
    const u = upper != null ? `+${Number(upper)}` : ""
    const l = lower != null ? `-${Number(lower)}` : ""
    return u && l ? `${u}/${l}` : u || l
  }

  const detailRows = details.map((d, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>
        <div class="cell-main">${d.materialName ?? d.materialCode ?? "—"}</div>
      </td>
      <td>
        <div class="cell-main">${d.kakouShiyou ?? "—"}</div>
        <div class="cell-sub">T:${d.kakouT ?? "-"} A:${d.kakouA ?? "-"} B:${d.kakouB ?? "-"}</div>
      </td>
      <td class="num dim">
        <div class="cell-main">${Number(d.sizeT)}×${Number(d.sizeB)}×${Number(d.sizeA)}</div>
        <div class="cell-sub">T ${fmtKousa(d.kousaTUpper, d.kousaTLower)} / A ${fmtKousa(d.kousaAUpper, d.kousaALower)} / B ${fmtKousa(d.kousaBUpper, d.kousaBLower)}</div>
      </td>
      <td class="num dim">${d.mentori4 != null ? Number(d.mentori4) + "C" : "—"} / ${d.mentori8 != null ? Number(d.mentori8) + "C" : "—"}</td>
      <td class="num">${d.quantity ?? ""}</td>
      <td class="num">¥${Number(d.unitPrice ?? 0).toLocaleString()}</td>
      <td class="num strong">¥${Number(d.totalPrice ?? 0).toLocaleString()}</td>
      <td class="dim">${d.shortestDelivery ?? "—"}</td>
      <td class="dim">${(d.remarks ?? d.customerDetailOrderNo) ?? "—"}</td>
    </tr>`).join("")

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>お見積回答書 ${estimate.estimateNo ?? ""}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
      font-size: 12px; color: #1e293b; background: #f1f5f9; padding: 20px;
    }
    @media print {
      body { background: #fff; padding: 10mm; }
      .no-print { display: none !important; }
      .sheet { box-shadow: none !important; border: none !important; }
      @page { size: A4; margin: 10mm; }
    }
    .no-print { text-align: center; padding: 14px; margin-bottom: 16px; }
    .no-print button {
      padding: 10px 28px; font-size: 14px; background: #1e3a5f; color: #fff;
      border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 2px 6px rgba(30,58,95,0.3);
    }
    .no-print button:hover { background: #16324a; }

    .sheet {
      max-width: 960px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0;
      border-radius: 10px; box-shadow: 0 4px 18px rgba(15,23,42,0.08); padding: 28px 32px;
    }

    /* タイトル帯（旧帳票の「お見積回答書・注文書」を踏襲） */
    .doc-title-bar {
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 3px double #1e3a5f; padding-bottom: 10px; margin-bottom: 18px;
    }
    .doc-title { font-size: 22px; font-weight: 700; letter-spacing: 6px; color: #1e3a5f; }
    .doc-title small { display: block; font-size: 10px; letter-spacing: 2px; color: #64748b; font-weight: 500; margin-top: 2px; }
    .doc-no-box { text-align: right; font-size: 11px; color: #475569; line-height: 1.7; }
    .doc-no-box .estno { font-size: 15px; font-weight: 700; color: #1e3a5f; font-family: monospace; letter-spacing: 1px; }

    /* 得意先ブロック（旧帳票の「御中」欄を大きく踏襲） */
    .top-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 18px; margin-bottom: 18px; }
    .dest-box { border: 2px solid #1e3a5f; border-radius: 8px; padding: 14px 16px; background: #f8fafc; }
    .dest-box .company { font-size: 19px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
    .dest-box .company .sama { font-size: 13px; font-weight: 500; margin-left: 4px; color: #475569; }
    .dest-box .sub { font-size: 12px; color: #334155; margin-bottom: 2px; }
    .dest-box .addr { font-size: 11px; color: #64748b; margin-top: 6px; }

    .info-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; background: #fff; }
    .info-card h3 {
      font-size: 10px; color: #1e3a5f; font-weight: 700; letter-spacing: 1px;
      margin-bottom: 8px; padding-bottom: 5px; border-bottom: 1px solid #e2e8f0; text-transform: uppercase;
    }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 11px; }
    .info-row .label { color: #64748b; flex-shrink: 0; margin-right: 8px; }
    .info-row .value { font-weight: 600; text-align: right; color: #1e293b; }

    /* 合計金額サマリーカード（注文確認画面ふうの強調表示） */
    .summary-banner {
      display: flex; align-items: center; justify-content: space-between;
      background: linear-gradient(135deg, #1e3a5f, #16324a); color: #fff;
      border-radius: 10px; padding: 14px 20px; margin-bottom: 18px;
    }
    .summary-banner .lbl { font-size: 11px; letter-spacing: 1px; opacity: 0.85; margin-bottom: 2px; }
    .summary-banner .amt { font-size: 26px; font-weight: 700; font-family: monospace; }
    .summary-banner .note { font-size: 10px; opacity: 0.75; text-align: right; line-height: 1.6; }

    /* 摘要（備考） */
    .remarks-box {
      border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px;
      font-size: 11px; background: #f8fafc;
    }
    .remarks-box .lbl { font-weight: 700; color: #1e3a5f; margin-right: 6px; }

    /* 明細テーブル */
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px; }
    thead th {
      background: #1e3a5f; color: #fff; padding: 7px 8px; text-align: center;
      font-weight: 600; white-space: nowrap; border: 1px solid #14293f;
    }
    tbody td { padding: 6px 8px; border: 1px solid #e2e8f0; vertical-align: middle; }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    .cell-main { font-weight: 600; color: #1e293b; }
    .cell-sub { font-size: 9px; color: #64748b; margin-top: 2px; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .dim { font-size: 10px; color: #475569; }
    .strong { font-weight: 700; color: #1e3a5f; }

    /* 金額内訳（旧帳票の 見積金額小計/運賃/消費税/合計 を踏襲） */
    .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 20px; }
    .totals-table { width: 320px; border-collapse: collapse; font-size: 12px; }
    .totals-table td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
    .totals-table td:first-child { color: #64748b; }
    .totals-table td:last-child { text-align: right; font-family: monospace; font-weight: 600; color: #1e293b; }
    .totals-table tr.grand td {
      border-top: 2px solid #1e3a5f; border-bottom: none; font-size: 15px;
      font-weight: 700; color: #1e3a5f; padding-top: 10px;
    }

    /* フッター（会社情報・支払条件・帳票番号） */
    .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 8px; }
    .company-info { font-size: 11px; color: #334155; line-height: 1.7; }
    .company-info .name { font-size: 15px; font-weight: 700; color: #1e3a5f; margin-bottom: 4px; }
    .seal-area { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; }
    .seal-box {
      width: 56px; height: 56px; border: 1px dashed #94a3b8; border-radius: 6px;
      display: flex; align-items: center; justify-content: center; font-size: 10px; color: #94a3b8;
    }
    .page-footer {
      margin-top: 18px; padding-top: 10px; border-top: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8;
      font-family: monospace; letter-spacing: 2px;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">🖨️ PDF印刷 / 保存</button>
  </div>

  <div class="sheet">

    <div class="doc-title-bar">
      <div class="doc-title">お見積回答書<small>ESTIMATE REPORT</small></div>
      <div class="doc-no-box">
        見積No：<span class="estno">${estimate.estimateNo ?? "—"}</span><br>
        見積日：${estimate.estimateDate ? new Date(estimate.estimateDate).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }) : issueDate}<br>
        見積有効期限：${validUntil}
      </div>
    </div>

    <div class="top-grid">
      <div class="dest-box">
        <div class="company">${estimate.destinationName ?? "—"}<span class="sama">御中</span></div>
        ${estimate.destinationDept ? `<div class="sub">${estimate.destinationDept}</div>` : ""}
        ${estimate.destinationPerson ? `<div class="sub">${estimate.destinationPerson} 様</div>` : ""}
        ${estimate.destinationAddress ? `<div class="addr">〒${estimate.destinationZip ?? ""} ${estimate.destinationAddress}</div>` : ""}
        <div class="sub" style="margin-top:8px; color:#475569;">
          平素より格別のお引き立てを賜り厚く御礼申し上げます。下記の通りお見積り申し上げます。
        </div>
      </div>
      <div class="info-card">
        <h3>見積情報</h3>
        <div class="info-row"><span class="label">お客様注文No</span><span class="value">${estimate.customerOrderNo ?? "—"}</span></div>
        <div class="info-row"><span class="label">希望納期</span><span class="value">${(estimate as any).requestNouki ?? "—"}</span></div>
        <div class="info-row"><span class="label">担当者名</span><span class="value">${(estimate as any).chargeName ?? "—"}</span></div>
        <div class="info-row"><span class="label">発行日</span><span class="value">${issueDate}</span></div>
        <div class="seal-area">
          <div class="seal-box">確認</div>
          <div class="seal-box">担当</div>
        </div>
      </div>
    </div>

    <div class="summary-banner">
      <div>
        <div class="lbl">御見積合計金額（税込）</div>
        <div class="amt">¥${grandTotal.toLocaleString()}</div>
      </div>
      <div class="note">
        小計 ¥${subtotal.toLocaleString()}（税抜）<br>
        消費税(10%) ¥${tax.toLocaleString()}
      </div>
    </div>

    ${estimate.remarks ? `
    <div class="remarks-box"><span class="lbl">摘要・備考</span>${estimate.remarks}</div>` : ""}

    <table>
      <thead>
        <tr>
          <th style="width:3%">No</th>
          <th style="width:10%">材質</th>
          <th style="width:14%">仕上り表示記号<br>（加工仕様・指示）</th>
          <th style="width:20%">寸法(厚みT×長さB×幅A)<br>及び公差</th>
          <th style="width:8%">面取指示<br>(4C/8C)</th>
          <th style="width:5%">数量</th>
          <th style="width:9%">単価</th>
          <th style="width:9%">金額</th>
          <th style="width:9%">納期</th>
          <th style="width:13%">備考・お客様注番</th>
        </tr>
      </thead>
      <tbody>
        ${detailRows}
      </tbody>
    </table>

    <div class="totals-wrap">
      <table class="totals-table">
        <tr><td>見積金額小計（税抜）</td><td>¥${subtotal.toLocaleString()}</td></tr>
        <tr><td>消費税（10%）</td><td>¥${tax.toLocaleString()}</td></tr>
        <tr class="grand"><td>御見積合計金額</td><td>¥${grandTotal.toLocaleString()}</td></tr>
      </table>
    </div>

    <div class="footer-grid">
      <div class="company-info">
        <div class="name">越智製作所</div>
        <div>〒577-0802 大阪府東大阪市小若江3-4-1</div>
        <div>TEL：072-882-5524　FAX：072-882-5527</div>
        <div>E-mail：weborder@ochi-ss.co.jp</div>
      </div>
      <div class="info-card">
        <h3>お支払条件</h3>
        <div class="info-row"><span class="value" style="font-weight:500;">月末締め翌月末払い</span></div>
        <div style="margin-top:6px; color:#94a3b8; font-size:10px; line-height:1.6;">
          ※ 見積有効期限内にご注文をお願いいたします<br>
          ※ 価格は税抜表示の内訳を上記に明記しております
        </div>
      </div>
    </div>

    <div class="page-footer">
      <span>1 / 1 ページ</span>
      <span>${estimate.estimateNo ?? ""}</span>
    </div>

  </div>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
