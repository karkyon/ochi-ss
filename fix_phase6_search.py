#!/usr/bin/env python3
"""
fix_phase6_search.py  Phase 6: 見積一覧・検索機能強化
=============================================================
Task 6-1-1: 見積No 範囲検索（noFrom〜noTo）── 既存実装済みのため確認のみ
Task 6-1-2: GET /api/v1/estimates に estimateNoFrom/To パラメータ追加（既存）
Task 6-1-3: Draftのみフィルタ（?status=draft）追加
Task 6-2-1: 一覧テーブルに「送り先住所」カラム追加
Task 6-2-2: Draftステータスの行に「下書き中」バッジ（復元リンク付き）
Task 6-3-1/2: 見積日付・見積Noカラムソート（URL ?sort=&order=）
Task 6-4-1: 検索条件をURLパラメータに保持（既存の push 方式で対応済み確認）
=============================================================
"""
import subprocess
from pathlib import Path

ROOT = Path.home() / "projects" / "ochi-ss"
PASS, FAIL = [], []

def apply(label, path, old, new):
    p = ROOT / path
    if not p.exists():
        FAIL.append(f"[{label}] ファイル未存在: {path}")
        return False
    content = p.read_text(encoding="utf-8")
    if old not in content:
        FAIL.append(f"[{label}] 検索文字列が見つかりません")
        return False
    p.write_text(content.replace(old, new, 1), encoding="utf-8")
    PASS.append(label)
    print(f"  ✅ {label}")
    return True

def run_tsc():
    r = subprocess.run(["npx","tsc","--noEmit"], cwd=ROOT, capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr

print("=" * 60)
print("  fix_phase6_search.py  Phase 6: 見積一覧・検索強化")
print("=" * 60)

# ════════════════════════════════════════════════════════════
# Task 6-1-3 + 6-3: page.tsx — status フィルタ / sort / order 対応
# ════════════════════════════════════════════════════════════
print("\n[Task 6-1-3 / 6-3] page.tsx に status / sort / order パラメータ追加")

PAGE_PATH = "src/app/(app)/estimates/page.tsx"

# SearchParams 型に追加
apply(
    "page: SearchParams型に status/sort/order 追加",
    PAGE_PATH,
    """type SearchParams = {
  dateFrom?: string
  dateTo?: string
  noFrom?: string
  noTo?: string
  destName?: string
  orderNo?: string
  page?: string
}""",
    """type SearchParams = {
  dateFrom?: string
  dateTo?: string
  noFrom?: string
  noTo?: string
  destName?: string
  orderNo?: string
  status?: string   // "draft" でDraftのみ
  sort?: string     // "estimateDate" | "estimateNo"
  order?: string    // "asc" | "desc"
  page?: string
}"""
)

# sp からの変数取得に追加
apply(
    "page: sp変数取得に status/sort/order 追加",
    PAGE_PATH,
    '  const dateFrom = sp.dateFrom ?? def.dateFrom\n  const dateTo   = sp.dateTo   ?? def.dateTo\n  const noFrom   = sp.noFrom   ?? ""\n  const noTo     = sp.noTo     ?? ""\n  const destName = sp.destName ?? ""\n  const orderNo  = sp.orderNo  ?? ""',
    '  const dateFrom = sp.dateFrom ?? def.dateFrom\n  const dateTo   = sp.dateTo   ?? def.dateTo\n  const noFrom   = sp.noFrom   ?? ""\n  const noTo     = sp.noTo     ?? ""\n  const destName = sp.destName ?? ""\n  const orderNo  = sp.orderNo  ?? ""\n  const status   = sp.status   ?? ""\n  const sort     = sp.sort     ?? "estimateDate"\n  const order    = (sp.order === "asc" ? "asc" : "desc") as "asc" | "desc"'
)

# where 条件に status（draft フィルタ）追加
apply(
    "page: where に status フィルタ追加",
    PAGE_PATH,
    '    ...(noFrom   && { estimateNo: { gte: noFrom } }),\n    ...(noTo     && { estimateNo: { lte: noTo } }),\n    ...(destName && { destinationName: { contains: destName } }),\n    ...(orderNo  && { customerOrderNo: { contains: orderNo } }),\n  }',
    '    ...(noFrom   && { estimateNo: { gte: noFrom } }),\n    ...(noTo     && { estimateNo: { lte: noTo } }),\n    ...(destName && { destinationName: { contains: destName } }),\n    ...(orderNo  && { customerOrderNo: { contains: orderNo } }),\n    ...(status === "draft" && { isDraftOnly: true }),\n  }'
)

# orderBy を動的ソートに変更
apply(
    "page: orderBy を動的ソートに変更",
    PAGE_PATH,
    '      orderBy: { estimateDate: "desc" },',
    '      orderBy: sort === "estimateNo"\n        ? { estimateNo: order }\n        : { estimateDate: order },'
)

# select に destinationAddress / isDraftOnly 追加
apply(
    "page: select に destinationAddress/isDraftOnly 追加",
    PAGE_PATH,
    """        select: {
        id:              true,
        estimateNo:      true,
        estimateDate:    true,
        destinationName: true,
        estimateStatus:  true,
        customerOrderNo: true,
        details: {
          where: { isDeleted: false },
          select: { totalPrice: true },
        },
      },""",
    """        select: {
        id:                true,
        estimateNo:        true,
        estimateDate:      true,
        destinationName:   true,
        destinationAddress: true,
        estimateStatus:    true,
        isDraftOnly:       true,
        customerOrderNo:   true,
        details: {
          where: { isDeleted: false },
          select: { totalPrice: true },
        },
      },"""
)

# rows.map に destinationAddress / isDraftOnly を追加
apply(
    "page: rows.map に destinationAddress/isDraftOnly 追加",
    PAGE_PATH,
    """  const estimates = rows.map((r) => ({
    id:              r.id,
    estimateNo:      r.estimateNo ?? "",
    estimateDate:    r.estimateDate?.toISOString().slice(0, 10) ?? "",
    destinationName: r.destinationName ?? "—",
    estimateStatus:  r.estimateStatus,
    customerOrderNo: r.customerOrderNo ?? "",
    detailCount:     r.details.length,
    totalAmount:     r.details.reduce((s, d) => s + Number(d.totalPrice ?? 0), 0),
  }))""",
    """  const estimates = rows.map((r) => ({
    id:                 r.id,
    estimateNo:         r.estimateNo ?? "",
    estimateDate:       r.estimateDate?.toISOString().slice(0, 10) ?? "",
    destinationName:    r.destinationName ?? "—",
    destinationAddress: r.destinationAddress ?? "",
    estimateStatus:     r.estimateStatus,
    isDraftOnly:        r.isDraftOnly,
    customerOrderNo:    r.customerOrderNo ?? "",
    detailCount:        r.details.length,
    totalAmount:        r.details.reduce((s, d) => s + Number(d.totalPrice ?? 0), 0),
  }))"""
)

# EstimatesClient への props に status/sort/order を渡す
apply(
    "page: EstimatesClient に status/sort/order props 追加",
    PAGE_PATH,
    '        defaultValues={{ dateFrom, dateTo, noFrom, noTo, destName, orderNo }}',
    '        defaultValues={{ dateFrom, dateTo, noFrom, noTo, destName, orderNo, status, sort, order }}'
)

# ════════════════════════════════════════════════════════════
# Task 6-1-3/6-2-1/6-2-2/6-3: EstimatesClient.tsx 全面強化
# ════════════════════════════════════════════════════════════
print("\n[Task 6-1-3/6-2-1/6-2-2/6-3] EstimatesClient.tsx 強化")

CLIENT_PATH = "src/app/(app)/estimates/EstimatesClient.tsx"

# Estimate 型に destinationAddress / isDraftOnly 追加
apply(
    "EstimatesClient: Estimate型拡張",
    CLIENT_PATH,
    """type Estimate = {
  id: string
  estimateNo: string
  estimateDate: string
  destinationName: string
  estimateStatus: string
  customerOrderNo: string
  detailCount: number
  totalAmount: number
}""",
    """type Estimate = {
  id: string
  estimateNo: string
  estimateDate: string
  destinationName: string
  destinationAddress: string
  estimateStatus: string
  isDraftOnly: boolean
  customerOrderNo: string
  detailCount: number
  totalAmount: number
}"""
)

# defaultValues 型に status/sort/order 追加
apply(
    "EstimatesClient: defaultValues型拡張",
    CLIENT_PATH,
    """  defaultValues: {
    dateFrom: string
    dateTo: string
    noFrom: string
    noTo: string
    destName: string
    orderNo: string
  }""",
    """  defaultValues: {
    dateFrom: string
    dateTo: string
    noFrom: string
    noTo: string
    destName: string
    orderNo: string
    status: string
    sort: string
    order: string
  }"""
)

# handleSearch の params 構築後に sort/order/status も保持
apply(
    "EstimatesClient: handleSearch に sort/order/status 保持",
    CLIENT_PATH,
    """  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formRef.current) return
    const fd = new FormData(formRef.current)
    const params = new URLSearchParams()
    for (const [k, v] of fd.entries()) {
      if (v) params.set(k, v as string)
    }
    params.set("page", "1")
    console.log("[検索ボタン] クリック 検索条件:", Object.fromEntries(params.entries()))
    router.push(`/estimates?${params.toString()}`)
  }""",
    """  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formRef.current) return
    const fd = new FormData(formRef.current)
    const params = new URLSearchParams()
    for (const [k, v] of fd.entries()) {
      if (v) params.set(k, v as string)
    }
    params.set("page", "1")
    // sort/order は現在値を引き継ぐ
    if (defaultValues.sort)  params.set("sort",  defaultValues.sort)
    if (defaultValues.order) params.set("order", defaultValues.order)
    router.push(`/estimates?${params.toString()}`)
  }

  // ソートトグル
  const handleSort = (col: string) => {
    const newOrder = defaultValues.sort === col && defaultValues.order === "desc" ? "asc" : "desc"
    const params = new URLSearchParams()
    Object.entries(defaultValues).forEach(([k, v]) => { if (v) params.set(k, v) })
    params.set("sort", col)
    params.set("order", newOrder)
    params.set("page", "1")
    router.push(`/estimates?${params.toString()}`)
  }

  // ソートアイコン
  const sortIcon = (col: string) => {
    if (defaultValues.sort !== col) return <span className="text-gray-300 ml-1">⇅</span>
    return defaultValues.order === "asc"
      ? <span className="text-blue-500 ml-1">↑</span>
      : <span className="text-blue-500 ml-1">↓</span>
  }"""
)

# buildPageUrl に status/sort/order 保持を追加
apply(
    "EstimatesClient: buildPageUrl に sort/order 保持",
    CLIENT_PATH,
    """  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams()
    Object.entries(defaultValues).forEach(([k, v]) => { if (v) params.set(k, v) })
    para""",
    """  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams()
    Object.entries(defaultValues).forEach(([k, v]) => { if (v) params.set(k, v) })
    // para"""  # 次の行への接続のため先頭を維持
)

# ↑の fix が不完全なので別アプローチ: buildPageUrl 全体を置き換え
p_client = ROOT / CLIENT_PATH
if p_client.exists():
    content = p_client.read_text(encoding="utf-8")
    # buildPageUrl を正確に修正（para→params のまま）
    content = content.replace(
        "    // para",
        "    para"
    )
    p_client.write_text(content, encoding="utf-8")
    print("  ✅ EstimatesClient: buildPageUrl para→params 修正")

# 検索フォームに Draftフィルタ チェックボックス追加
apply(
    "EstimatesClient: Draftフィルタチェックボックス追加",
    CLIENT_PATH,
    """        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            クリア
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-[#1a2744] text-white text-sm font-medium hover:bg-[#1a3a6e] transition-colors"
          >
            🔍 検索
          </button>
        </div>""",
    """        <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              name="status"
              value="draft"
              defaultChecked={defaultValues.status === "draft"}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            下書き（Draft）のみ表示
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              クリア
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#1a2744] text-white text-sm font-medium hover:bg-[#1a3a6e] transition-colors"
            >
              🔍 検索
            </button>
          </div>
        </div>"""
)

# テーブルヘッダー: 送り先住所カラム追加 + ソートボタン
apply(
    "EstimatesClient: テーブルヘッダー ソート+住所カラム追加",
    CLIENT_PATH,
    """              <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">見積No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">見積日付</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">送り先名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">お客様注文No</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">合計金額</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">明細数</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">状態</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">操作</th>
                </tr>
              </thead>""",
    """              <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 cursor-pointer hover:text-blue-600 whitespace-nowrap"
                      onClick={() => handleSort("estimateNo")}>
                    見積No{sortIcon("estimateNo")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 cursor-pointer hover:text-blue-600 whitespace-nowrap"
                      onClick={() => handleSort("estimateDate")}>
                    見積日付{sortIcon("estimateDate")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">送り先名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">送り先住所</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">お客様注文No</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">合計金額</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">明細数</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">状態</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">操作</th>
                </tr>
              </thead>"""
)

# テーブル行: destinationAddress セル追加 + Draft バッジ
p_client2 = ROOT / CLIENT_PATH
if p_client2.exists():
    content2 = p_client2.read_text(encoding="utf-8")
    # 送り先名 td の後に送り先住所 td を挿入
    old_dest_td = """                      <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">
                        {est.destinationName}
                      </td>"""
    new_dest_td = """                      <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">
                        {est.destinationName}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[180px] truncate">
                        {est.destinationAddress || "—"}
                      </td>"""
    if old_dest_td in content2:
        content2 = content2.replace(old_dest_td, new_dest_td)
        p_client2.write_text(content2, encoding="utf-8")
        PASS.append("EstimatesClient: 送り先住所セル追加")
        print("  ✅ EstimatesClient: 送り先住所セル追加")
    else:
        FAIL.append("EstimatesClient: destinationName tdパターン不一致")

# Draft バッジ: estimateStatus セルに isDraftOnly 判定を追加
p_client3 = ROOT / CLIENT_PATH
if p_client3.exists():
    content3 = p_client3.read_text(encoding="utf-8")
    # ステータスバッジの span を isDraftOnly 対応に拡張
    old_badge = """                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                          {st.label}
                        </span>
                      </td>"""
    new_badge = """                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                            {st.label}
                          </span>
                          {est.isDraftOnly && (
                            <Link
                              href={`/estimates/${est.id}/edit`}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 whitespace-nowrap"
                            >
                              ✏ 下書き中
                            </Link>
                          )}
                        </div>
                      </td>"""
    if old_badge in content3:
        content3 = content3.replace(old_badge, new_badge)
        p_client3.write_text(content3, encoding="utf-8")
        PASS.append("EstimatesClient: Draftバッジ追加")
        print("  ✅ EstimatesClient: Draftバッジ追加")
    else:
        FAIL.append("EstimatesClient: ステータスバッジパターン不一致")

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

print("\n" + "=" * 60)
print(f"  完了: {len(PASS)}件  失敗: {len(FAIL)}件")
if FAIL:
    print("\n  ❌ 失敗一覧:")
    for f in FAIL: print(f"    {f}")
else:
    print("""
  ✅ Phase 6 実装完了！
  次のコマンドを実行:
  git add -A && git commit -m 'feat: Phase6 見積一覧 ソート/Draft絞り込み/住所カラム/URLパラメータ保持'
  git push
""")
print("=" * 60)
