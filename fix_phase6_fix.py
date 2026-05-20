#!/usr/bin/env python3
"""
fix_phase6_fix.py  Phase 6 残件修正
- page.tsx: select に destinationAddress/isDraftOnly 追加（TSエラー解消）
- EstimatesClient.tsx: テーブルヘッダー・行に住所/Draftバッジ追加
"""
import subprocess
from pathlib import Path
import re

ROOT = Path.home() / "projects" / "ochi-ss"
PASS, FAIL = [], []

def w(label, path, old, new):
    p = ROOT / path
    c = p.read_text(encoding="utf-8")
    if old not in c:
        FAIL.append(f"[{label}] パターン不一致")
        print(f"  ❌ {label}")
        return False
    p.write_text(c.replace(old, new, 1), encoding="utf-8")
    PASS.append(label)
    print(f"  ✅ {label}")
    return True

print("=" * 60)
print("  fix_phase6_fix.py  Phase 6 残件修正")
print("=" * 60)

# ─────────────────────────────────────────────
# 1. page.tsx: select に destinationAddress/isDraftOnly 追加
# ─────────────────────────────────────────────
print("\n[Fix 1] page.tsx select フィールド追加")
w(
    "page: select にフィールド追加",
    "src/app/(app)/estimates/page.tsx",
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
        id:                 true,
        estimateNo:         true,
        estimateDate:       true,
        destinationName:    true,
        destinationAddress: true,
        estimateStatus:     true,
        isDraftOnly:        true,
        customerOrderNo:    true,
        details: {
          where: { isDeleted: false },
          select: { totalPrice: true },
        },
      },"""
)

# ─────────────────────────────────────────────
# 2. EstimatesClient.tsx: thead ソート付きヘッダーに変更
# ─────────────────────────────────────────────
print("\n[Fix 2] EstimatesClient thead 差し替え")
w(
    "EstimatesClient: thead 差し替え",
    "src/app/(app)/estimates/EstimatesClient.tsx",
    """              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                    見積No
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                    見積日付
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                    送り先名
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">
                    合計額（税抜）
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap">
                    件数
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap">
                    状況
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap">
                    操作
                  </th>
                </tr>
              </thead>""",
    """              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap cursor-pointer hover:text-blue-600"
                      onClick={() => handleSort("estimateNo")}>
                    見積No{sortIcon("estimateNo")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap cursor-pointer hover:text-blue-600"
                      onClick={() => handleSort("estimateDate")}>
                    見積日付{sortIcon("estimateDate")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                    送り先名
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                    送り先住所
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 whitespace-nowrap">
                    合計額（税抜）
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap">
                    件数
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap">
                    状況
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap">
                    操作
                  </th>
                </tr>
              </thead>"""
)

# ─────────────────────────────────────────────
# 3. tbody: 送り先名 td の後に送り先住所 td を挿入
# ─────────────────────────────────────────────
print("\n[Fix 3] tbody 送り先住所セル追加")
CLIENT = ROOT / "src/app/(app)/estimates/EstimatesClient.tsx"
content = CLIENT.read_text(encoding="utf-8")

# 送り先名 td を探す（実際のコードに合わせて柔軟に）
# まず destinationName が含まれる td ブロックを特定
old_name_td = """{est.destinationName
                            ? est.destinationName
                            : "—"
                          }"""
new_name_td = """{est.destinationName
                            ? est.destinationName
                            : "—"
                          }"""

# 送り先名 td の終わり（</td>）の直後に住所 td を挿入
# tbody全体から送り先名のtdパターンを探す
import re

# tbody の中で destinationName を含む td を探す
pattern = r'(<td[^>]*>\s*\{est\.destinationName[^<]*(?:<[^/][^>]*>[^<]*</[^>]*>[^<]*)?\s*\}\s*</td>)'
match = re.search(pattern, content, re.DOTALL)

if match:
    old_block = match.group(0)
    new_block = old_block + """\n                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[180px] truncate">
                        {est.destinationAddress || "—"}
                      </td>"""
    content = content.replace(old_block, new_block, 1)
    CLIENT.write_text(content, encoding="utf-8")
    PASS.append("EstimatesClient: 送り先住所セル追加")
    print("  ✅ EstimatesClient: 送り先住所セル追加")
else:
    # フォールバック: テキストベースで探す
    # 実際のコードパターンを見て直接検索
    idx = content.find("est.destinationName")
    if idx >= 0:
        # td の終了を探す
        td_end = content.find("</td>", idx)
        if td_end >= 0:
            insert_pos = td_end + 5  # </td>の後
            insert_text = """\n                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[180px] truncate">
                        {est.destinationAddress || "—"}
                      </td>"""
            content = content[:insert_pos] + insert_text + content[insert_pos:]
            CLIENT.write_text(content, encoding="utf-8")
            PASS.append("EstimatesClient: 送り先住所セル追加(fallback)")
            print("  ✅ EstimatesClient: 送り先住所セル追加(fallback)")
    else:
        FAIL.append("EstimatesClient: destinationName td が見つかりません")
        print("  ❌ EstimatesClient: destinationName td が見つかりません")

# ─────────────────────────────────────────────
# 4. tbody: ステータス td に isDraftOnly バッジ追加
# ─────────────────────────────────────────────
print("\n[Fix 4] tbody Draftバッジ追加")
content = CLIENT.read_text(encoding="utf-8")

# 状況 td を探す: status.label を含む span の td
old_status_td = """                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>"""
new_status_td = """                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                            {status.label}
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

if old_status_td in content:
    content = content.replace(old_status_td, new_status_td, 1)
    CLIENT.write_text(content, encoding="utf-8")
    PASS.append("EstimatesClient: Draftバッジ追加")
    print("  ✅ EstimatesClient: Draftバッジ追加")
else:
    # status.label を含む span td を柔軟に検索
    idx2 = content.find("{status.label}")
    if idx2 >= 0:
        # 周囲の td を取得して置換
        td_start = content.rfind("<td", 0, idx2)
        td_end = content.find("</td>", idx2) + 5
        old_chunk = content[td_start:td_end]
        new_chunk = """<td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                          {est.isDraftOnly && (
                            <Link href={`/estimates/${est.id}/edit`}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 whitespace-nowrap">
                              ✏ 下書き中
                            </Link>
                          )}
                        </div>
                      </td>"""
        content = content[:td_start] + new_chunk + content[td_end:]
        CLIENT.write_text(content, encoding="utf-8")
        PASS.append("EstimatesClient: Draftバッジ追加(fallback)")
        print("  ✅ EstimatesClient: Draftバッジ追加(fallback)")
    else:
        FAIL.append("EstimatesClient: status.label td が見つかりません")
        print("  ❌ EstimatesClient: status.label td が見つかりません")

# ─────────────────────────────────────────────
# TypeScript チェック
# ─────────────────────────────────────────────
print("\n[TypeScript チェック]")
r = subprocess.run(["npx","tsc","--noEmit"], cwd=ROOT, capture_output=True, text=True)
if r.returncode == 0:
    print("  ✅ tsc --noEmit: エラーなし")
else:
    print(f"  ❌ tsc エラー:\n{r.stdout}{r.stderr}")
    FAIL.append("tsc")

print("\n" + "=" * 60)
print(f"  完了: {len(PASS)}件  失敗: {len(FAIL)}件")
if FAIL:
    print("\n  ❌ 失敗:")
    for f in FAIL: print(f"    {f}")
else:
    print("""
  ✅ Phase 6 完全完了！
  git add -A && git commit -m 'feat: Phase6 見積一覧 ソート/Draft絞込/住所/URLパラメータ保持'
  git push
""")
print("=" * 60)
