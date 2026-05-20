#!/usr/bin/env python3
"""
fix_phase5_pdf.py  Phase 5: 帳票（PDF）の完全実装
=============================================================
Task 5-1-1: 見積書PDF に 公差T/A/B・面取り4C/8C・加工指示T/A/B カラム追加
Task 5-1-2: 見積書PDF に 見積日付・希望納期・担当者名 を印字
Task 5-2-1: 注文書PDF に同フィールドを追加（見積書と同様）
=============================================================
"""
import subprocess, sys
from pathlib import Path

ROOT = Path.home() / "projects" / "ochi-ss"
PASS, FAIL = [], []

def apply(label, path, old, new):
    p = ROOT / path
    if not p.exists():
        FAIL.append(f"[{label}] ファイル未存在: {path}")
        return
    content = p.read_text(encoding="utf-8")
    if old not in content:
        FAIL.append(f"[{label}] 検索文字列が見つかりません")
        return
    p.write_text(content.replace(old, new, 1), encoding="utf-8")
    PASS.append(label)
    print(f"  ✅ {label}")

def run_tsc():
    r = subprocess.run(["npx","tsc","--noEmit"], cwd=ROOT, capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr

print("=" * 60)
print("  fix_phase5_pdf.py  Phase 5: 帳票PDF 完全実装")
print("=" * 60)

# ════════════════════════════════════════════════════════════
# Task 5-1: 見積書 PDF
# ════════════════════════════════════════════════════════════
ESTIMATE_PDF = "src/app/api/v1/estimates/[id]/pdf/route.ts"

print("\n[Task 5-1-1] 見積書 detailRows に公差・面取り・加工指示カラム追加")
apply(
    "見積PDF: detailRows カラム拡張",
    ESTIMATE_PDF,
    """  const detailRows = (estimate.details as any[]).map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${d.materialName ?? d.materialCode ?? ""}</td>
      <td>${d.kakouShiyou ?? ""}</td>
      <td class="num">${Number(d.sizeT)}×${Number(d.sizeA)}×${Number(d.sizeB)}</td>
      <td class="num">${d.quantity ?? ""}</td>
      <td class="num">¥${Number(d.unitPrice ?? 0).toLocaleString()}</td>
      <td class="num">¥${Number(d.totalPrice ?? 0).toLocaleString()}</td>
      <td>${d.shortestDelivery ?? "—"}</td>
    </tr>`).join("")""",
    r"""  // 公差フォーマットヘルパー
  const fmtKousa = (upper: any, lower: any) => {
    if (upper == null && lower == null) return "—"
    const u = upper != null ? `+${Number(upper)}` : ""
    const l = lower != null ? `-${Number(lower)}` : ""
    return u && l ? `${u}/${l}` : u || l
  }
  // 法人格区分テキスト
  const CORP_TYPE: Record<string, string> = {
    "1":"株式会社","2":"有限会社","3":"合同会社","4":"合資会社",
    "5":"合名会社","6":"財団法人","7":"社団法人","8":"協同組合","9":"組合"
  }

  const detailRows = (estimate.details as any[]).map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${d.materialName ?? d.materialCode ?? ""}</td>
      <td>${d.kakouShiyou ?? ""}</td>
      <td class="num">${Number(d.sizeT)}×${Number(d.sizeA)}×${Number(d.sizeB)}</td>
      <td class="num dim">${fmtKousa(d.kousaTUpper,d.kousaTLower)}</td>
      <td class="num dim">${fmtKousa(d.kousaAUpper,d.kousaALower)}</td>
      <td class="num dim">${fmtKousa(d.kousaBUpper,d.kousaBLower)}</td>
      <td class="num dim">${d.mentori4 != null ? Number(d.mentori4)+"C" : "—"}</td>
      <td class="num dim">${d.mentori8 != null ? Number(d.mentori8)+"C" : "—"}</td>
      <td class="dim">${d.kakouT ?? "—"}</td>
      <td class="dim">${d.kakouA ?? "—"}</td>
      <td class="dim">${d.kakouB ?? "—"}</td>
      <td class="num">${d.quantity ?? ""}</td>
      <td class="num">¥${Number(d.unitPrice ?? 0).toLocaleString()}</td>
      <td class="num">¥${Number(d.totalPrice ?? 0).toLocaleString()}</td>
      <td>${d.shortestDelivery ?? "—"}</td>
    </tr>`).join("")"""
)

print("\n[Task 5-1-2] 見積書 見積情報ブロックに estimateDate / chargeName 追加 + テーブルヘッダー拡張")
# 見積情報ブロック: 見積日付・担当者名を追加
apply(
    "見積PDF: 見積情報ブロック estimateDate + chargeName",
    ESTIMATE_PDF,
    '      <div class="info-row"><span class="label">希望納期</span><span class="value">${(estimate as any).requestNouki ?? "—"}</span></div>',
    """      <div class="info-row"><span class="label">見積日付</span><span class="value">${estimate.estimateDate ? new Date(estimate.estimateDate).toLocaleDateString("ja-JP",{year:"numeric",month:"2-digit",day:"2-digit"}) : "—"}</span></div>
      <div class="info-row"><span class="label">希望納期</span><span class="value">${(estimate as any).requestNouki ?? "—"}</span></div>
      <div class="info-row"><span class="label">担当者名</span><span class="value">${(estimate as any).chargeName ?? "—"}</span></div>"""
)

# テーブルヘッダーに公差・面取り・加工指示列を追加
apply(
    "見積PDF: tableヘッダー列追加",
    ESTIMATE_PDF,
    """      <tr>
        <th style="width:3%">No</th>
        <th style="width:12%">材料</th>
        <th style="width:10%">加工仕様</th>
        <th style="width:15%">寸法T×A×B</th>
        <th style="width:6%">数量</th>
        <th style="width:10%">単価</th>
        <th style="width:11%">金額</th>
        <th style="width:10%">最短納期</th>
      </tr>""",
    """      <tr>
        <th style="width:3%">No</th>
        <th style="width:10%">材料</th>
        <th style="width:8%">加工仕様</th>
        <th style="width:12%">寸法T×A×B</th>
        <th style="width:5%">公差T</th>
        <th style="width:5%">公差A</th>
        <th style="width:5%">公差B</th>
        <th style="width:4%">4C</th>
        <th style="width:4%">8C</th>
        <th style="width:5%">指示T</th>
        <th style="width:5%">指示A</th>
        <th style="width:5%">指示B</th>
        <th style="width:4%">数量</th>
        <th style="width:8%">単価</th>
        <th style="width:8%">金額</th>
        <th style="width:9%">最短納期</th>
      </tr>"""
)

# テーブル tfoot の colspan を 6→12 に更新
apply(
    "見積PDF: tfoot colspan 更新",
    ESTIMATE_PDF,
    '        <td colspan="6" class="num">合　計（税抜）</td>',
    '        <td colspan="12" class="num">合　計（税抜）</td>'
)

# CSSに dim クラス追加（補助列用の小さめフォント）
apply(
    "見積PDF: CSS .dim クラス追加",
    ESTIMATE_PDF,
    "    .num { text-align: right; font-variant-numeric: tabular-nums; }",
    "    .num { text-align: right; font-variant-numeric: tabular-nums; }\n    .dim { font-size: 10px; text-align: center; color: #555; }"
)

# ════════════════════════════════════════════════════════════
# Task 5-2: 注文書 PDF
# ════════════════════════════════════════════════════════════
ORDER_PDF = "src/app/api/v1/orders/[id]/pdf/route.ts"

print("\n[Task 5-2-1] 注文書 detailRows に公差・面取り・加工指示カラム追加")
apply(
    "注文PDF: detailRows カラム拡張",
    ORDER_PDF,
    """  const detailRows = details.map((d: any, i: number) => `
    <tr>
      <td>${i + 1}</td>
      <td>${d.materialName ?? d.materialCode ?? ""}</td>
      <td>${d.kakouShiyou ?? ""}</td>
      <td class="num">${Number(d.sizeT)}×${Number(d.sizeA)}×${Number(d.sizeB)}</td>
      <td class="num">${d.quantity ?? ""}</td>
      <td class="num">¥${Number(d.unitPrice ?? 0).toLocaleString()}</td>
      <td class="num">¥${Number(d.totalPrice ?? 0).toLocaleString()}</td>
      <td>${d.shortestDelivery ?? "—"}</td>
    </tr>`).join("")""",
    r"""  // 公差フォーマット
  const fmtK = (upper: any, lower: any) => {
    if (upper == null && lower == null) return "—"
    const u = upper != null ? `+${Number(upper)}` : ""
    const l = lower != null ? `-${Number(lower)}` : ""
    return u && l ? `${u}/${l}` : u || l
  }

  const detailRows = details.map((d: any, i: number) => `
    <tr>
      <td>${i + 1}</td>
      <td>${d.materialName ?? d.materialCode ?? ""}</td>
      <td>${d.kakouShiyou ?? ""}</td>
      <td class="num">${Number(d.sizeT)}×${Number(d.sizeA)}×${Number(d.sizeB)}</td>
      <td class="num dim">${fmtK(d.kousaTUpper,d.kousaTLower)}</td>
      <td class="num dim">${fmtK(d.kousaAUpper,d.kousaALower)}</td>
      <td class="num dim">${fmtK(d.kousaBUpper,d.kousaBLower)}</td>
      <td class="num dim">${d.mentori4 != null ? Number(d.mentori4)+"C" : "—"}</td>
      <td class="num dim">${d.mentori8 != null ? Number(d.mentori8)+"C" : "—"}</td>
      <td class="dim">${d.kakouT ?? "—"}</td>
      <td class="dim">${d.kakouA ?? "—"}</td>
      <td class="dim">${d.kakouB ?? "—"}</td>
      <td class="num">${d.quantity ?? ""}</td>
      <td class="num">¥${Number(d.unitPrice ?? 0).toLocaleString()}</td>
      <td class="num">¥${Number(d.totalPrice ?? 0).toLocaleString()}</td>
      <td>${d.shortestDelivery ?? "—"}</td>
    </tr>`).join("")"""
)

# 注文書テーブルヘッダーに列追加
apply(
    "注文PDF: tableヘッダー列追加",
    ORDER_PDF,
    """    th { background: #1a2744; color: #fff; padding: 6px 8px; text-align: left; font-weight: 500; white-space: nowrap; }""",
    """    th { background: #1a2744; color: #fff; padding: 6px 8px; text-align: left; font-weight: 500; white-space: nowrap; }
    .dim { font-size: 10px; text-align: center; color: #555; }"""
)

# 注文書: 注文情報ブロックに estimateDate / chargeName 追加
# 注文書の info-block を探して見積日付・担当者を追加
p_order = ROOT / ORDER_PDF
if p_order.exists():
    content = p_order.read_text(encoding="utf-8")
    # 注文書の見積情報ブロック内にあるお客様注文No の後に追加
    old_info = '${estimate?.customerOrderNo ?? "—"}</span></div>'
    new_info = '${estimate?.customerOrderNo ?? "—"}</span></div>\n      <div class="info-row"><span class="label">見積日付</span><span class="value">${estimate?.estimateDate ? new Date(estimate.estimateDate).toLocaleDateString("ja-JP",{year:"numeric",month:"2-digit",day:"2-digit"}) : "—"}</span></div>\n      <div class="info-row"><span class="label">希望納期</span><span class="value">${estimate?.requestNouki ?? "—"}</span></div>\n      <div class="info-row"><span class="label">担当者名</span><span class="value">${estimate?.chargeName ?? "—"}</span></div>'
    if old_info in content:
        p_order.write_text(content.replace(old_info, new_info, 1), encoding="utf-8")
        PASS.append("注文PDF: 見積日付/希望納期/担当者名追加")
        print("  ✅ 注文PDF: 見積日付/希望納期/担当者名追加")
    else:
        FAIL.append("注文PDF: customerOrderNo 箇所が見つかりません")

# 注文書テーブルヘッダー列追加
apply(
    "注文PDF: tableヘッダー列追加",
    ORDER_PDF,
    """  <table>
    <thead>""",
    """  <table style="font-size:10px;">
    <thead>"""
)

# 注文書の明細ヘッダー（既存行を探して差し替え）
p_order2 = ROOT / ORDER_PDF
if p_order2.exists():
    content2 = p_order2.read_text(encoding="utf-8")
    # 注文書ヘッダー行を特定して差し替え
    old_thead = """      <tr>
        <th>No</th><th>材料</th><th>加工仕様</th><th>寸法T×A×B</th>
        <th>数量</th><th>単価</th><th>金額</th><th>最短納期</th>
      </tr>"""
    new_thead = """      <tr>
        <th>No</th><th>材料</th><th>加工仕様</th><th>寸法T×A×B</th>
        <th>公差T</th><th>公差A</th><th>公差B</th>
        <th>4C</th><th>8C</th><th>指示T</th><th>指示A</th><th>指示B</th>
        <th>数量</th><th>単価</th><th>金額</th><th>最短納期</th>
      </tr>"""
    if old_thead in content2:
        p_order2.write_text(content2.replace(old_thead, new_thead, 1), encoding="utf-8")
        PASS.append("注文PDF: テーブルヘッダー列追加")
        print("  ✅ 注文PDF: テーブルヘッダー列追加")
    else:
        # thead が 1行形式の場合に対応
        old_tr2 = '<th>No</th><th>材料</th><th>加工仕様</th><th>寸法T×A×B</th>\n        <th>数量</th><th>単価</th><th>金額</th><th>最短納期</th>'
        if old_tr2 in content2:
            content2 = content2.replace(
                old_tr2,
                '<th>No</th><th>材料</th><th>加工仕様</th><th>寸法T×A×B</th>\n        <th>公差T</th><th>公差A</th><th>公差B</th>\n        <th>4C</th><th>8C</th><th>指示T</th><th>指示A</th><th>指示B</th>\n        <th>数量</th><th>単価</th><th>金額</th><th>最短納期</th>'
            )
            p_order2.write_text(content2, encoding="utf-8")
            PASS.append("注文PDF: テーブルヘッダー列追加(alt)")
            print("  ✅ 注文PDF: テーブルヘッダー列追加(alt)")
        else:
            # colspan 更新だけ適用
            FAIL.append("注文PDF: theadヘッダー行パターン不一致（手動確認要）")

# 注文書 tfoot colspan 更新
p_order3 = ROOT / ORDER_PDF
if p_order3.exists():
    content3 = p_order3.read_text(encoding="utf-8")
    for old_cf, new_cf in [
        ('colspan="6"', 'colspan="12"'),
        ('colspan="5"', 'colspan="12"'),
        ('colspan="4"', 'colspan="12"'),
    ]:
        if old_cf in content3 and "合　計" in content3:
            # tfoot の colspan だけ変更
            lines = content3.split("\n")
            for i, line in enumerate(lines):
                if old_cf in line and "合　計" in line:
                    lines[i] = line.replace(old_cf, 'colspan="12"', 1)
                    break
            content3 = "\n".join(lines)
            p_order3.write_text(content3, encoding="utf-8")
            PASS.append(f"注文PDF: tfoot colspan {old_cf}→12")
            print(f"  ✅ 注文PDF: tfoot colspan {old_cf}→12")
            break

# ─────────────────────────────────────────────────────────
# TypeScript チェック
# ─────────────────────────────────────────────────────────
print("\n[TypeScript チェック]")
code, out = run_tsc()
if code == 0:
    print("  ✅ tsc --noEmit: エラーなし")
else:
    print(f"  ❌ tsc エラー:\n{out}")
    FAIL.append("tsc エラー")

# ─────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print(f"  完了: {len(PASS)}件  失敗: {len(FAIL)}件")
if FAIL:
    print("\n  ❌ 失敗一覧:")
    for f in FAIL: print(f"    {f}")
else:
    print("""
  ✅ Phase 5 実装完了！
  次のコマンドを実行:
  git add -A && git commit -m 'feat: Phase5 帳票PDF 公差・面取り・加工指示・見積日付・担当者名 追加'
  git push
""")
print("=" * 60)
