#!/usr/bin/env python3
"""
fix_phase2_ts_errors.py
TSエラー修正 + 未適用パッチ再適用

修正内容:
1. EstimateData に estimateDate / chargeName / requestNouki を追加 → TSエラー解消
2. Edit Client の明細テーブル tbody に公差・面取りセル追加
3. Edit Client の削除ボタン隣に編集ボタン追加
4. Edit Client の handleSave payload に estimateDate / chargeName / requestNouki 追加
5. New Client の tbody 公差・面取りセル + 編集ボタン（⚠が出ていた箇所）
"""

import os

def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()

def write(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  ✅ 書き込み完了: {path}")

def patch(content, old, new, label):
    if old not in content:
        print(f"  ⚠️  [{label}] 対象文字列未発見（既適用か確認）")
        return content, False
    result = content.replace(old, new, 1)
    print(f"  ✅ [{label}] 適用")
    return result, True


# ════════════════════════════════════════════════════
# Fix 1: EstimateData に estimateDate / chargeName / requestNouki 追加
# ════════════════════════════════════════════════════
def fix_estimate_data_interface():
    path = "src/app/(app)/estimates/[id]/edit/EstimateEditClient.tsx"
    print(f"\n{'─'*60}")
    print(f"[Fix 1] EstimateData インターフェース修正（TSエラー解消）")
    print('─'*60)

    if not os.path.exists(path):
        print(f"  ❌ 未発見: {path}")
        return False

    content = read(path)
    changed = False

    if "requestNouki:     string" in content and "chargeName:       string" in content:
        print("  ℹ️  既に追加済み（スキップ）")
        return False

    old = (
        "  destinationFax:   string\n"
        "  remarks:          string\n"
        "  details: {"
    )
    new = (
        "  destinationFax:   string\n"
        "  requestNouki:     string\n"
        "  chargeName:       string\n"
        "  estimateDate:     string\n"
        "  remarks:          string\n"
        "  details: {"
    )
    content, ok = patch(content, old, new, "EstimateData: estimateDate / chargeName / requestNouki 追加")
    if ok: changed = True

    if changed:
        write(path, content)
    return changed


# ════════════════════════════════════════════════════
# Fix 2: Edit Client tbody + 編集ボタン + handleSave payload
# ════════════════════════════════════════════════════
def fix_edit_client():
    path = "src/app/(app)/estimates/[id]/edit/EstimateEditClient.tsx"
    print(f"\n{'─'*60}")
    print(f"[Fix 2] EstimateEditClient: tbody / 編集ボタン / handleSave")
    print('─'*60)

    if not os.path.exists(path):
        print(f"  ❌ 未発見: {path}")
        return False

    content = read(path)
    changed = False

    # ── handleSave payload に estimateDate / requestNouki / chargeName 追加 ──
    # ドキュメント2の handleSave を確認すると requestNouki も未追加
    old_save = (
        "        remarks:            header.remarks || undefined,\n"
        "        editMode:           \"Edit\" as const,"
    )
    new_save = (
        "        estimateDate:       header.estimateDate || header.inputDate,\n"
        "        requestNouki:       header.requestNouki || undefined,\n"
        "        chargeName:         header.chargeName || undefined,\n"
        "        remarks:            header.remarks || undefined,\n"
        "        editMode:           \"Edit\" as const,"
    )
    content, ok = patch(content, old_save, new_save, "[Edit] handleSave: estimateDate / requestNouki / chargeName")
    if ok: changed = True

    # ── tbody: 数量の前に公差・面取りセルを挿入 ──
    # ドキュメント2の実際のパターン（T/A/B セルの直後に数量）
    old_qty = (
        "                  <td className=\"px-3 py-2 text-right text-gray-700\">{d.quantity}</td>\n"
        "                  <td className=\"px-3 py-2 text-right text-gray-700\">\n"
        "                    {d.unitPrice != null ? `¥${d.unitPrice.toLocaleString()}` : \"—\"}\n"
        "                  </td>"
    )
    new_qty = (
        "                  <td className=\"px-3 py-2 text-right font-mono whitespace-nowrap text-[10px]\">\n"
        "                    {d.kousaTUpper || d.kousaTLower ? `+${d.kousaTUpper||0}/-${d.kousaTLower||0}` : \"–\"}\n"
        "                  </td>\n"
        "                  <td className=\"px-3 py-2 text-right font-mono whitespace-nowrap text-[10px]\">\n"
        "                    {d.kousaAUpper || d.kousaALower ? `+${d.kousaAUpper||0}/-${d.kousaALower||0}` : \"–\"}\n"
        "                  </td>\n"
        "                  <td className=\"px-3 py-2 text-right font-mono whitespace-nowrap text-[10px]\">\n"
        "                    {d.kousaBUpper || d.kousaBLower ? `+${d.kousaBUpper||0}/-${d.kousaBLower||0}` : \"–\"}\n"
        "                  </td>\n"
        "                  <td className=\"px-3 py-2 text-right font-mono whitespace-nowrap text-[10px]\">{d.mentori4 || \"–\"}</td>\n"
        "                  <td className=\"px-3 py-2 text-right font-mono whitespace-nowrap text-[10px]\">{d.mentori8 || \"–\"}</td>\n"
        "                  <td className=\"px-3 py-2 text-right text-gray-700\">{d.quantity}</td>\n"
        "                  <td className=\"px-3 py-2 text-right text-gray-700\">\n"
        "                    {d.unitPrice != null ? `¥${d.unitPrice.toLocaleString()}` : \"—\"}\n"
        "                  </td>"
    )
    content, ok = patch(content, old_qty, new_qty, "[Edit] tbody: 公差・面取りセル追加")
    if ok: changed = True

    # ── 削除ボタン隣に編集ボタン追加（ドキュメント2の1行形式）──
    old_del = (
        "                    <button onClick={() => handleDeleteDetail(d.clientDetailId)}\n"
        "                      className=\"px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors\">削除</button>"
    )
    new_del = (
        "                    <button onClick={() => handleDeleteDetail(d.clientDetailId)}\n"
        "                      className=\"px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors\">削除</button>\n"
        "                    <button type=\"button\" onClick={() => handleEditDetail(d.clientDetailId)}\n"
        "                      className=\"px-2 py-1 text-xs rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors ml-1\">編集</button>"
    )
    content, ok = patch(content, old_del, new_del, "[Edit] 削除ボタン隣に編集ボタン追加")
    if ok: changed = True

    if changed:
        write(path, content)
    return changed


# ════════════════════════════════════════════════════
# Fix 3: EstimateNewClient tbody セル + 編集ボタン
# ════════════════════════════════════════════════════
def fix_new_client_tbody():
    path = "src/app/(app)/estimates/new/EstimateNewClient.tsx"
    print(f"\n{'─'*60}")
    print(f"[Fix 3] EstimateNewClient: tbody 公差・面取りセル + 編集ボタン")
    print('─'*60)

    if not os.path.exists(path):
        print(f"  ❌ 未発見: {path}")
        return False

    content = read(path)
    changed = False

    # New Client の tbody 数量セル（6スペース×4 = 24スペースのインデント）
    old_qty = (
        "                    <td className=\"px-3 py-2 text-right font-mono whitespace-nowrap\">{d.quantity}</td>\n"
        "                    <td className=\"px-3 py-2 text-right font-mono whitespace-nowrap\">"
        "{d.unitPrice != null ? `¥${Math.round(d.unitPrice).toLocaleString()}` : \"–\"}</td>"
    )
    new_qty = (
        "                    <td className=\"px-3 py-2 text-right font-mono whitespace-nowrap text-[10px]\">\n"
        "                      {d.kousaTUpper || d.kousaTLower ? `+${d.kousaTUpper||0}/-${d.kousaTLower||0}` : \"–\"}\n"
        "                    </td>\n"
        "                    <td className=\"px-3 py-2 text-right font-mono whitespace-nowrap text-[10px]\">\n"
        "                      {d.kousaAUpper || d.kousaALower ? `+${d.kousaAUpper||0}/-${d.kousaALower||0}` : \"–\"}\n"
        "                    </td>\n"
        "                    <td className=\"px-3 py-2 text-right font-mono whitespace-nowrap text-[10px]\">\n"
        "                      {d.kousaBUpper || d.kousaBLower ? `+${d.kousaBUpper||0}/-${d.kousaBLower||0}` : \"–\"}\n"
        "                    </td>\n"
        "                    <td className=\"px-3 py-2 text-right font-mono whitespace-nowrap text-[10px]\">{d.mentori4 || \"–\"}</td>\n"
        "                    <td className=\"px-3 py-2 text-right font-mono whitespace-nowrap text-[10px]\">{d.mentori8 || \"–\"}</td>\n"
        "                    <td className=\"px-3 py-2 text-right font-mono whitespace-nowrap\">{d.quantity}</td>\n"
        "                    <td className=\"px-3 py-2 text-right font-mono whitespace-nowrap\">"
        "{d.unitPrice != null ? `¥${Math.round(d.unitPrice).toLocaleString()}` : \"–\"}</td>"
    )
    content, ok = patch(content, old_qty, new_qty, "New tbody: 公差・面取りセル追加")
    if ok: changed = True

    # 削除ボタン（New版の実際のパターンを確認）
    old_del1 = (
        "                      onClick={() => handleDeleteDetail(d.clientDetailId)}\n"
        "                      className=\"px-2 py-1 text-[10px] bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors\"\n"
        "                    >\n"
        "                      削除\n"
        "                    </button>"
    )
    new_del1 = (
        "                      onClick={() => handleDeleteDetail(d.clientDetailId)}\n"
        "                      className=\"px-2 py-1 text-[10px] bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors\"\n"
        "                    >\n"
        "                      削除\n"
        "                    </button>\n"
        "                    <button\n"
        "                      type=\"button\"\n"
        "                      onClick={() => handleEditDetail(d.clientDetailId)}\n"
        "                      className=\"px-2 py-1 text-[10px] bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors\"\n"
        "                    >\n"
        "                      編集\n"
        "                    </button>"
    )
    content, ok = patch(content, old_del1, new_del1, "New tbody: 編集ボタン追加")
    if ok: changed = True

    if changed:
        write(path, content)
    return changed


# ════════════════════════════════════════════════════
# メイン
# ════════════════════════════════════════════════════
if __name__ == "__main__":
    print("╔══════════════════════════════════════════╗")
    print("║  fix_phase2_ts_errors.py                 ║")
    print("║  TSエラー修正 + 未適用パッチ再適用        ║")
    print("╚══════════════════════════════════════════╝")

    results = {}
    results["estimate_data_interface"] = fix_estimate_data_interface()
    results["edit_client"]             = fix_edit_client()
    results["new_client_tbody"]        = fix_new_client_tbody()

    print("\n" + "="*60)
    print("修正完了サマリー:")
    for k, v in results.items():
        status = "✅ 変更あり" if v else "ℹ️  変更なし/スキップ"
        print(f"  {status} — {k}")
    print("")
    print("次ステップ:")
    print("  npx tsc --noEmit")
    print("  # エラー 0 確認後:")
    print("  git add -A && git commit -m 'fix: TSエラー修正 EstimateData型 + 公差セル + 編集ボタン'")
    print("  git push")
    print("="*60)
