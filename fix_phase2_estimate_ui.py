#!/usr/bin/env python3
"""
fix_phase2_estimate_ui.py
Phase 2 — 見積入力画面の業務フィールド完全実装

Task 2-1: requestNouki・chargeName をヘッダー UI・API に追加
Task 2-5: 明細行に「編集」ボタン追加
Task 2-6: 明細テーブルに公差・面取りカラム追加
Task 2-7: API (POST/PUT) で requestNouki・chargeName を DB に保存

対象ファイル:
  src/app/(app)/estimates/new/EstimateNewClient.tsx
  src/app/(app)/estimates/[id]/edit/EstimateEditClient.tsx
  src/app/api/v1/estimates/route.ts
  src/app/api/v1/estimates/[id]/route.ts
"""

import sys
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
# Task 2-1 & 2-7: route.ts (POST) 修正
# requestNouki・chargeName を DB に保存
# ════════════════════════════════════════════════════

def fix_route_post():
    path = "src/app/api/v1/estimates/route.ts"
    print(f"\n{'─'*60}")
    print(f"[route.ts POST] requestNouki / chargeName DB保存")
    print('─'*60)

    if not os.path.exists(path):
        print(f"  ❌ 未発見: {path}")
        return False

    content = read(path)
    changed = False

    # SaveHeaderRequest に chargeName を追加
    old = "  requestNouki?: string\n  remarks?: string\n  editMode: \"New\" | \"Edit\" | \"Copy\""
    new = (
        "  requestNouki?: string\n"
        "  chargeName?: string\n"
        "  remarks?: string\n"
        "  editMode: \"New\" | \"Edit\" | \"Copy\""
    )
    content, ok = patch(content, old, new, "SaveHeaderRequest に chargeName 追加")
    if ok: changed = True

    # create の data に requestNouki / chargeName を追加
    # "// requestNouki は EstimateHeader スキーマ非存在のため除外" を実際の保存に変更
    old = (
        "          // chargeName は EstimateHeader スキーマ非存在 → createdBy に保存\n"
        "          createdBy:       session.user.chargeName ?? session.user.userId ?? \"\",\n"
        "          estimateDate:    new Date(body.inputDate),\n"
        "          inputDate:       new Date(body.inputDate),\n"
    )
    new = (
        "          chargeName:      body.chargeName ?? session.user.chargeName ?? null,\n"
        "          createdBy:       body.chargeName ?? session.user.chargeName ?? session.user.userId ?? \"\",\n"
        "          estimateDate:    new Date(body.inputDate),\n"
        "          inputDate:       new Date(body.inputDate),\n"
    )
    content, ok = patch(content, old, new, "POST create: chargeName 保存")
    if ok: changed = True

    # "// requestNouki は EstimateHeader スキーマ非存在のため除外" を実際の保存に変更
    old = (
        "          shippingMethodId: body.shippingMethodId ?? null,\n"
        "          // requestNouki は EstimateHeader スキーマ非存在のため除外\n"
        "          remarks:         body.remarks ?? null,"
    )
    new = (
        "          shippingMethodId: body.shippingMethodId ?? null,\n"
        "          requestNouki:    body.requestNouki ?? null,\n"
        "          remarks:         body.remarks ?? null,"
    )
    content, ok = patch(content, old, new, "POST create: requestNouki 保存")
    if ok: changed = True

    if changed:
        write(path, content)
    return changed


# ════════════════════════════════════════════════════
# Task 2-1 & 2-7: [id]/route.ts (PUT) 修正
# ════════════════════════════════════════════════════

def fix_route_put():
    path = "src/app/api/v1/estimates/[id]/route.ts"
    print(f"\n{'─'*60}")
    print(f"[[id]/route.ts PUT] requestNouki / chargeName DB更新")
    print('─'*60)

    if not os.path.exists(path):
        print(f"  ❌ 未発見: {path}")
        return False

    content = read(path)
    changed = False

    # ヘッダー更新 data に requestNouki・chargeName を追加
    # estimateDate 行の直後に挿入
    old = (
        "          estimateDate:      new Date(body.inputDate),\n"
        "          customerOrderNo:   body.customerOrderNo ?? null,"
    )
    new = (
        "          estimateDate:      new Date(body.inputDate),\n"
        "          requestNouki:      body.requestNouki ?? null,\n"
        "          chargeName:        body.chargeName ?? null,\n"
        "          customerOrderNo:   body.customerOrderNo ?? null,"
    )
    content, ok = patch(content, old, new, "PUT update: requestNouki / chargeName 追加")
    if ok: changed = True

    if changed:
        write(path, content)
    return changed


# ════════════════════════════════════════════════════
# Task 2-1: EstimateNewClient.tsx 修正
# HeaderForm に estimateDate / chargeName 追加 + UI
# Task 2-5: 明細行に編集ボタン追加
# Task 2-6: 明細テーブルに公差・面取りカラム追加
# ════════════════════════════════════════════════════

def fix_new_client():
    path = "src/app/(app)/estimates/new/EstimateNewClient.tsx"
    print(f"\n{'─'*60}")
    print(f"[EstimateNewClient.tsx] ヘッダーUI / 明細テーブル修正")
    print('─'*60)

    if not os.path.exists(path):
        print(f"  ❌ 未発見: {path}")
        return False

    content = read(path)
    changed = False

    # ── 2-1-4: HeaderForm 型に estimateDate / chargeName 追加 ──
    old = (
        "type HeaderForm = {\n"
        "  inputDate: string\n"
        "  customerOrderNo: string\n"
    )
    new = (
        "type HeaderForm = {\n"
        "  inputDate: string\n"
        "  estimateDate: string\n"
        "  chargeName: string\n"
        "  customerOrderNo: string\n"
    )
    content, ok = patch(content, old, new, "HeaderForm に estimateDate / chargeName 追加")
    if ok: changed = True

    # ── 2-1-4: useState 初期値に estimateDate / chargeName 追加 ──
    old = (
        "    inputDate:          todayStr(),\n"
        "    customerOrderNo:    copySource?.customerOrderNo ?? \"\","
    )
    new = (
        "    inputDate:          todayStr(),\n"
        "    estimateDate:       todayStr(),\n"
        "    chargeName:         userInfo.chargeName ?? \"\",\n"
        "    customerOrderNo:    copySource?.customerOrderNo ?? \"\","
    )
    content, ok = patch(content, old, new, "useState 初期値: estimateDate / chargeName")
    if ok: changed = True

    # ── 2-1-1/2-1-3: ヘッダー UI に見積日付・担当者名・希望納期フィールド追加 ──
    # 「入力日付」の input の直後に挿入
    old = (
        "          className=\"w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500\"\n"
        "            />\n"
        "          </div>\n"
        "\n"
        "          {/* お客様注文番号 */}"
    )
    new = (
        "          className=\"w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500\"\n"
        "            />\n"
        "          </div>\n"
        "\n"
        "          {/* 見積日付 */}\n"
        "          <div>\n"
        "            <label className=\"block text-xs font-medium text-gray-600 mb-1\">\n"
        "              見積日付 <span className=\"text-red-500\">*</span>\n"
        "            </label>\n"
        "            <input\n"
        "              type=\"date\"\n"
        "              value={header.estimateDate}\n"
        "              onChange={e => setHeader(h => ({ ...h, estimateDate: e.target.value }))}\n"
        "              className=\"w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-yellow-50\"\n"
        "            />\n"
        "          </div>\n"
        "\n"
        "          {/* 希望納期 */}\n"
        "          <div>\n"
        "            <label className=\"block text-xs font-medium text-gray-600 mb-1\">希望納期</label>\n"
        "            <input\n"
        "              type=\"text\"\n"
        "              value={header.requestNouki}\n"
        "              onChange={e => setHeader(h => ({ ...h, requestNouki: e.target.value }))}\n"
        "              placeholder=\"例: 2026-06-30\"\n"
        "              maxLength={20}\n"
        "              className=\"w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-yellow-50\"\n"
        "            />\n"
        "          </div>\n"
        "\n"
        "          {/* 担当者名 */}\n"
        "          <div>\n"
        "            <label className=\"block text-xs font-medium text-gray-600 mb-1\">担当者名</label>\n"
        "            <input\n"
        "              type=\"text\"\n"
        "              value={header.chargeName}\n"
        "              onChange={e => setHeader(h => ({ ...h, chargeName: e.target.value }))}\n"
        "              maxLength={50}\n"
        "              className=\"w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-yellow-50\"\n"
        "            />\n"
        "          </div>\n"
        "\n"
        "          {/* お客様注文番号 */}"
    )
    content, ok = patch(content, old, new, "ヘッダーUI: 見積日付 / 希望納期 / 担当者名 追加")
    if ok: changed = True

    # ── 2-1-5: handleSave payload に estimateDate / chargeName を追加 ──
    old = (
        "        requestNouki:      header.requestNouki || undefined,\n"
        "        remarks:           header.remarks || undefined,"
    )
    new = (
        "        estimateDate:      header.estimateDate || header.inputDate,\n"
        "        requestNouki:      header.requestNouki || undefined,\n"
        "        chargeName:        header.chargeName || undefined,\n"
        "        remarks:           header.remarks || undefined,"
    )
    content, ok = patch(content, old, new, "handleSave payload: estimateDate / chargeName")
    if ok: changed = True

    # ── 2-5: 明細行に「編集」ボタン追加 + handleEditDetail 関数追加 ──
    # handleDeleteDetail の直後に handleEditDetail を追加
    old = (
        "  const handleDeleteDetail = (clientDetailId: string) => {\n"
        "    setDetails(prev =>\n"
        "      prev\n"
        "        .filter(d => d.clientDetailId !== clientDetailId)\n"
        "        .map((d, i) => ({ ...d, rowNo: i + 1 }))\n"
        "    )\n"
        "  }"
    )
    new = (
        "  const handleDeleteDetail = (clientDetailId: string) => {\n"
        "    setDetails(prev =>\n"
        "      prev\n"
        "        .filter(d => d.clientDetailId !== clientDetailId)\n"
        "        .map((d, i) => ({ ...d, rowNo: i + 1 }))\n"
        "    )\n"
        "  }\n"
        "\n"
        "  // ── 明細行 編集（Task 2-5）──\n"
        "  const handleEditDetail = (clientDetailId: string) => {\n"
        "    const target = details.find(d => d.clientDetailId === clientDetailId)\n"
        "    if (!target) return\n"
        "    // フォームに値をセット\n"
        "    setDetailForm({\n"
        "      materialCode:    target.materialCode,\n"
        "      kakouShiyouCode: target.kakouShiyouCode,\n"
        "      kakouShijiCodeT: target.kakouShijiCodeT,\n"
        "      kakouShijiCodeA: target.kakouShijiCodeA,\n"
        "      kakouShijiCodeB: target.kakouShijiCodeB,\n"
        "      sizeT: target.sizeT, sizeA: target.sizeA, sizeB: target.sizeB,\n"
        "      kousaTUpper: target.kousaTUpper, kousaTLower: target.kousaTLower,\n"
        "      kousaAUpper: target.kousaAUpper, kousaALower: target.kousaALower,\n"
        "      kousaBUpper: target.kousaBUpper, kousaBLower: target.kousaBLower,\n"
        "      mentori4: target.mentori4, mentori8: target.mentori8,\n"
        "      quantity: target.quantity,\n"
        "    })\n"
        "    // 対象行を一覧から削除（再計算→追加の流れ）\n"
        "    setDetails(prev => prev.filter(d => d.clientDetailId !== clientDetailId).map((d, i) => ({ ...d, rowNo: i + 1 })))\n"
        "    setCalcResult(null)\n"
        "    setCalcError(\"\")\n"
        "    window.scrollTo({ top: 0, behavior: 'smooth' })\n"
        "  }"
    )
    content, ok = patch(content, old, new, "handleEditDetail 追加")
    if ok: changed = True

    # ── 2-6: 明細テーブルヘッダーに公差・面取りカラム追加 ──
    old = (
        "                  <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">数量</th>\n"
        "                  <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">単価</th>\n"
        "                  <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">金額</th>\n"
        "                  <th className=\"px-3 py-2 text-center text-gray-500 whitespace-nowrap\">最短納期</th>\n"
        "                  <th className=\"px-3 py-2 text-center text-gray-500 whitespace-nowrap\">操作</th>"
    )
    new = (
        "                  <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">公差T</th>\n"
        "                  <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">公差A</th>\n"
        "                  <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">公差B</th>\n"
        "                  <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">4C</th>\n"
        "                  <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">8C</th>\n"
        "                  <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">数量</th>\n"
        "                  <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">単価</th>\n"
        "                  <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">金額</th>\n"
        "                  <th className=\"px-3 py-2 text-center text-gray-500 whitespace-nowrap\">最短納期</th>\n"
        "                  <th className=\"px-3 py-2 text-center text-gray-500 whitespace-nowrap\">操作</th>"
    )
    content, ok = patch(content, old, new, "明細テーブル: 公差・面取りカラムヘッダー追加")
    if ok: changed = True

    # ── 明細テーブル tbody: 公差・面取りデータセル + 編集ボタン追加 ──
    # 数量セルの直前に公差・面取りセルを挿入し、削除ボタンの隣に編集ボタンを追加
    old = (
        "                    <td className=\"px-3 py-2 text-right font-mono whitespace-nowrap\">{d.quantity}</td>\n"
        "                    <td className=\"px-3 py-2 text-right font-mono whitespace-nowrap\">{d.unitPrice != null ? `¥${Math.round(d.unitPrice).toLocaleString()}` : \"–\"}</td>"
    )
    new = (
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
        "                    <td className=\"px-3 py-2 text-right font-mono whitespace-nowrap\">{d.unitPrice != null ? `¥${Math.round(d.unitPrice).toLocaleString()}` : \"–\"}</td>"
    )
    content, ok = patch(content, old, new, "明細テーブル tbody: 公差・面取りセル追加")
    if ok: changed = True

    # 削除ボタンの隣に編集ボタンを追加
    old = (
        "                      onClick={() => handleDeleteDetail(d.clientDetailId)}\n"
        "                      className=\"px-2 py-1 text-[10px] bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors\"\n"
        "                    >\n"
        "                      削除\n"
        "                    </button>"
    )
    new = (
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
    content, ok = patch(content, old, new, "明細テーブル: 編集ボタン追加")
    if ok: changed = True

    if changed:
        write(path, content)
    return changed


# ════════════════════════════════════════════════════
# Task 2-1: EstimateEditClient.tsx 修正（同様の変更）
# ════════════════════════════════════════════════════

def fix_edit_client():
    path = "src/app/(app)/estimates/[id]/edit/EstimateEditClient.tsx"
    print(f"\n{'─'*60}")
    print(f"[EstimateEditClient.tsx] ヘッダーUI / 明細テーブル修正")
    print('─'*60)

    if not os.path.exists(path):
        print(f"  ❌ 未発見: {path}")
        return False

    content = read(path)
    changed = False

    # ── HeaderForm に estimateDate / chargeName 追加 ──
    old = (
        "type HeaderForm = {\n"
        "  inputDate:         string\n"
        "  customerOrderNo:   string\n"
    )
    new = (
        "type HeaderForm = {\n"
        "  inputDate:         string\n"
        "  estimateDate:      string\n"
        "  chargeName:        string\n"
        "  customerOrderNo:   string\n"
    )
    content, ok = patch(content, old, new, "[Edit] HeaderForm に estimateDate / chargeName 追加")
    if ok: changed = True

    # ── EstimateData 型に requestNouki / chargeName 追加 ──
    if "requestNouki:" not in content:
        old = (
            "  destinationFax:    string\n"
            "  shippingMethodId"
        )
        new = (
            "  destinationFax:    string\n"
            "  requestNouki:      string\n"
            "  chargeName:        string\n"
            "  shippingMethodId"
        )
        content, ok = patch(content, old, new, "[Edit] EstimateData に requestNouki / chargeName 追加")
        if ok: changed = True

    # ── useState 初期値（header）に estimateDate / chargeName 追加 ──
    # EstimateEditClient の header state 初期化部分
    old = (
        "  const [header, setHeader] = useState<HeaderForm>({\n"
        "    inputDate:         estimateData.inputDate,"
    )
    new = (
        "  const [header, setHeader] = useState<HeaderForm>({\n"
        "    inputDate:         estimateData.inputDate,\n"
        "    estimateDate:      estimateData.estimateDate ?? estimateData.inputDate,\n"
        "    chargeName:        estimateData.chargeName ?? userInfo.chargeName ?? \"\","
    )
    content, ok = patch(content, old, new, "[Edit] useState header: estimateDate / chargeName")
    if ok: changed = True

    # ── ヘッダーUI に見積日付・希望納期・担当者名フィールド追加 ──
    old = (
        "            <input type=\"date\" value={header.inputDate}\n"
        "              onChange={e => setHeader(h => ({ ...h, inputDate: e.target.value }))}\n"
        "              className=\"w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500\" />\n"
        "          </div>\n"
        "          <div>\n"
        "            <label className=\"block text-xs font-medium text-gray-600 mb-1\">お客様注文番号</label>"
    )
    new = (
        "            <input type=\"date\" value={header.inputDate}\n"
        "              onChange={e => setHeader(h => ({ ...h, inputDate: e.target.value }))}\n"
        "              className=\"w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500\" />\n"
        "          </div>\n"
        "          <div>\n"
        "            <label className=\"block text-xs font-medium text-gray-600 mb-1\">見積日付 <span className=\"text-red-500\">*</span></label>\n"
        "            <input type=\"date\" value={header.estimateDate}\n"
        "              onChange={e => setHeader(h => ({ ...h, estimateDate: e.target.value }))}\n"
        "              className=\"w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-yellow-50\" />\n"
        "          </div>\n"
        "          <div>\n"
        "            <label className=\"block text-xs font-medium text-gray-600 mb-1\">希望納期</label>\n"
        "            <input type=\"text\" value={header.requestNouki}\n"
        "              onChange={e => setHeader(h => ({ ...h, requestNouki: e.target.value }))}\n"
        "              placeholder=\"例: 2026-06-30\" maxLength={20}\n"
        "              className=\"w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-yellow-50\" />\n"
        "          </div>\n"
        "          <div>\n"
        "            <label className=\"block text-xs font-medium text-gray-600 mb-1\">担当者名</label>\n"
        "            <input type=\"text\" value={header.chargeName}\n"
        "              onChange={e => setHeader(h => ({ ...h, chargeName: e.target.value }))}\n"
        "              maxLength={50}\n"
        "              className=\"w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-yellow-50\" />\n"
        "          </div>\n"
        "          <div>\n"
        "            <label className=\"block text-xs font-medium text-gray-600 mb-1\">お客様注文番号</label>"
    )
    content, ok = patch(content, old, new, "[Edit] ヘッダーUI: 見積日付 / 希望納期 / 担当者名 追加")
    if ok: changed = True

    # ── handleSave payload に estimateDate / chargeName 追加 ──
    old = (
        "        requestNouki:      header.requestNouki || undefined,\n"
        "        remarks:           header.remarks || undefined,\n"
        "        editMode:          \"Edit\" as const,"
    )
    new = (
        "        estimateDate:      header.estimateDate || header.inputDate,\n"
        "        requestNouki:      header.requestNouki || undefined,\n"
        "        chargeName:        header.chargeName || undefined,\n"
        "        remarks:           header.remarks || undefined,\n"
        "        editMode:          \"Edit\" as const,"
    )
    content, ok = patch(content, old, new, "[Edit] handleSave payload: estimateDate / chargeName")
    if ok: changed = True

    # ── 明細テーブルヘッダーに公差・面取りカラム追加（Edit版） ──
    old = (
        "                <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">数量</th>\n"
        "                <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">単価</th>\n"
        "                <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">金額</th>\n"
        "                <th className=\"px-3 py-2 text-center text-gray-500 whitespace-nowrap\">最短納期</th>\n"
        "                <th className=\"px-3 py-2 text-center text-gray-500 whitespace-nowrap\">操作</th>"
    )
    new = (
        "                <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">公差T</th>\n"
        "                <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">公差A</th>\n"
        "                <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">公差B</th>\n"
        "                <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">4C</th>\n"
        "                <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">8C</th>\n"
        "                <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">数量</th>\n"
        "                <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">単価</th>\n"
        "                <th className=\"px-3 py-2 text-right text-gray-500 whitespace-nowrap\">金額</th>\n"
        "                <th className=\"px-3 py-2 text-center text-gray-500 whitespace-nowrap\">最短納期</th>\n"
        "                <th className=\"px-3 py-2 text-center text-gray-500 whitespace-nowrap\">操作</th>"
    )
    content, ok = patch(content, old, new, "[Edit] 明細テーブル: 公差・面取りカラムヘッダー追加")
    if ok: changed = True

    # ── 明細テーブル tbody: 公差・面取りセル + 編集ボタン追加（Edit版） ──
    # Edit 版の数量セル前に公差・面取りセルを挿入
    old = (
        "                  <td className=\"px-3 py-2 text-right font-mono whitespace-nowrap\">{d.quantity}</td>\n"
        "                  <td className=\"px-3 py-2 text-right font-mono whitespace-nowrap\">{d.unitPrice != null ? `¥${Math.round(d.unitPrice).toLocaleString()}` : \"–\"}</td>"
    )
    new = (
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
        "                  <td className=\"px-3 py-2 text-right font-mono whitespace-nowrap\">{d.quantity}</td>\n"
        "                  <td className=\"px-3 py-2 text-right font-mono whitespace-nowrap\">{d.unitPrice != null ? `¥${Math.round(d.unitPrice).toLocaleString()}` : \"–\"}</td>"
    )
    content, ok = patch(content, old, new, "[Edit] 明細テーブル tbody: 公差・面取りセル追加")
    if ok: changed = True

    # ── handleEditDetail 関数を追加（Edit版） ──
    old = (
        "  // ── 明細追加 ──\n"
        "  const canAddDetail = !!("
    )
    new = (
        "  // ── 明細行 編集（Task 2-5）──\n"
        "  const handleEditDetail = (clientDetailId: string) => {\n"
        "    const target = details.find(d => d.clientDetailId === clientDetailId)\n"
        "    if (!target) return\n"
        "    setDetailForm({\n"
        "      materialCode:    target.materialCode,\n"
        "      kakouShiyouCode: target.kakouShiyouCode,\n"
        "      kakouShijiCodeT: target.kakouShijiCodeT,\n"
        "      kakouShijiCodeA: target.kakouShijiCodeA,\n"
        "      kakouShijiCodeB: target.kakouShijiCodeB,\n"
        "      sizeT: target.sizeT, sizeA: target.sizeA, sizeB: target.sizeB,\n"
        "      kousaTUpper: target.kousaTUpper, kousaTLower: target.kousaTLower,\n"
        "      kousaAUpper: target.kousaAUpper, kousaALower: target.kousaALower,\n"
        "      kousaBUpper: target.kousaBUpper, kousaBLower: target.kousaBLower,\n"
        "      mentori4: target.mentori4, mentori8: target.mentori8,\n"
        "      quantity: target.quantity,\n"
        "    })\n"
        "    setDetails(prev => prev.filter(d => d.clientDetailId !== clientDetailId).map((d, i) => ({ ...d, rowNo: i + 1 })))\n"
        "    setCalcResult(null)\n"
        "    setCalcError(\"\")\n"
        "    window.scrollTo({ top: 0, behavior: 'smooth' })\n"
        "  }\n"
        "\n"
        "  // ── 明細追加 ──\n"
        "  const canAddDetail = !!("
    )
    content, ok = patch(content, old, new, "[Edit] handleEditDetail 追加")
    if ok: changed = True

    # Edit版の削除ボタン隣に編集ボタン追加
    old_del_btn_edit = (
        "              onClick={() => { console.log('[Edit][明細削除]', d.clientDetailId); handleDeleteDetail(d.clientDetailId) }}\n"
        "              className=\"px-2 py-1 text-[10px] bg-red-100 text-red-700 rounded hover:bg-red-200\"\n"
        "            >削除</button>"
    )
    new_del_btn_edit = (
        "              onClick={() => { console.log('[Edit][明細削除]', d.clientDetailId); handleDeleteDetail(d.clientDetailId) }}\n"
        "              className=\"px-2 py-1 text-[10px] bg-red-100 text-red-700 rounded hover:bg-red-200\"\n"
        "            >削除</button>\n"
        "            <button type=\"button\"\n"
        "              onClick={() => handleEditDetail(d.clientDetailId)}\n"
        "              className=\"px-2 py-1 text-[10px] bg-blue-100 text-blue-700 rounded hover:bg-blue-200\"\n"
        "            >編集</button>"
    )
    content, ok = patch(content, old_del_btn_edit, new_del_btn_edit, "[Edit] 明細テーブル: 編集ボタン追加")
    if ok: changed = True

    if changed:
        write(path, content)
    return changed


# ════════════════════════════════════════════════════
# edit/page.tsx 修正: estimateData に requestNouki / chargeName を含める
# ════════════════════════════════════════════════════

def fix_edit_page():
    path = "src/app/(app)/estimates/[id]/edit/page.tsx"
    print(f"\n{'─'*60}")
    print(f"[edit/page.tsx] estimateData に requestNouki / chargeName / estimateDate 追加")
    print('─'*60)

    if not os.path.exists(path):
        print(f"  ❌ 未発見: {path}")
        return False

    content = read(path)
    changed = False

    # estimateData オブジェクトに requestNouki / chargeName / estimateDate を追加
    old = (
        "    remarks:          estimate.remarks ?? \"\","
    )
    new = (
        "    requestNouki:     (estimate as any).requestNouki ?? \"\",\n"
        "    chargeName:       (estimate as any).chargeName ?? \"\",\n"
        "    estimateDate:     estimate.estimateDate?.toISOString().slice(0, 10) ?? estimate.inputDate.toISOString().slice(0, 10),\n"
        "    remarks:          estimate.remarks ?? \"\","
    )
    content, ok = patch(content, old, new, "estimateData: requestNouki / chargeName / estimateDate")
    if ok: changed = True

    if changed:
        write(path, content)
    return changed


# ════════════════════════════════════════════════════
# メイン
# ════════════════════════════════════════════════════
if __name__ == "__main__":
    print("╔══════════════════════════════════════════╗")
    print("║  fix_phase2_estimate_ui.py               ║")
    print("║  Phase 2: 見積入力画面 業務フィールド     ║")
    print("╚══════════════════════════════════════════╝")

    results = {}
    results["route_post"]   = fix_route_post()
    results["route_put"]    = fix_route_put()
    results["new_client"]   = fix_new_client()
    results["edit_client"]  = fix_edit_client()
    results["edit_page"]    = fix_edit_page()

    print("\n" + "="*60)
    print("Phase 2 完了サマリー:")
    for k, v in results.items():
        status = "✅ 変更あり" if v else "ℹ️  変更なし/スキップ"
        print(f"  {status} — {k}")
    print("")
    print("次ステップ:")
    print("  npx tsc --noEmit  # エラーがないことを確認")
    print("  git add -A && git commit -m 'fix: Phase2 estimate UI - requestNouki/chargeName/公差カラム/編集ボタン'")
    print("="*60)
