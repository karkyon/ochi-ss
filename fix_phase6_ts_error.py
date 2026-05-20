#!/usr/bin/env python3
"""
fix_phase6_ts_error.py  page.tsx TSエラー修正
select パターンが変化しているため、rows.map の型を as any[] でキャストして解消
"""
import subprocess
from pathlib import Path

ROOT = Path.home() / "projects" / "ochi-ss"
PAGE = ROOT / "src/app/(app)/estimates/page.tsx"

print("=" * 60)
print("  fix_phase6_ts_error.py  page.tsx TSエラー修正")
print("=" * 60)

content = PAGE.read_text(encoding="utf-8")

# 現在の select ブロックを出力して確認
start = content.find("select: {")
end   = content.find("},\n    }),\n  ])", start)
if start >= 0 and end >= 0:
    print("\n[現在の select ブロック]")
    print(content[start:end+5])
else:
    print("[select ブロックが見つかりません]")

# ── アプローチ：destinationAddress/isDraftOnly を select に追加
# 現在の select を全パターン試行
PATTERNS = [
    # パターンA（既にscaffold時のもの）
    (
        "        select: {\n        id:              true,\n        estimateNo:      true,\n        estimateDate:    true,\n        destinationName: true,\n        estimateStatus:  true,\n        customerOrderNo: true,\n        details: {\n          where: { isDeleted: false },\n          select: { totalPrice: true },\n        },\n      },",
        "        select: {\n        id:                 true,\n        estimateNo:         true,\n        estimateDate:       true,\n        destinationName:    true,\n        destinationAddress: true,\n        estimateStatus:     true,\n        isDraftOnly:        true,\n        customerOrderNo:    true,\n        details: {\n          where: { isDeleted: false },\n          select: { totalPrice: true },\n        },\n      },"
    ),
    # パターンB（インデント違い）
    (
        "      select: {\n        id:              true,\n        estimateNo:      true,\n        estimateDate:    true,\n        destinationName: true,\n        estimateStatus:  true,\n        customerOrderNo: true,\n        details: {\n          where: { isDeleted: false },\n          select: { totalPrice: true },\n        },\n      },",
        "      select: {\n        id:                 true,\n        estimateNo:         true,\n        estimateDate:       true,\n        destinationName:    true,\n        destinationAddress: true,\n        estimateStatus:     true,\n        isDraftOnly:        true,\n        customerOrderNo:    true,\n        details: {\n          where: { isDeleted: false },\n          select: { totalPrice: true },\n        },\n      },"
    ),
]

fixed = False
for old, new in PATTERNS:
    if old in content:
        content = content.replace(old, new, 1)
        PAGE.write_text(content, encoding="utf-8")
        print(f"\n  ✅ select パターンマッチ・フィールド追加完了")
        fixed = True
        break

if not fixed:
    # フォールバック: 正規表現で select ブロックを検出して追加
    import re
    # destinationName: true の後に destinationAddress/isDraftOnly を追加
    pattern = r"(destinationName:\s*true,\s*\n)(\s*estimateStatus:\s*true,)"
    replacement = r"\1        destinationAddress: true,\n        isDraftOnly:        true,\n\2"
    new_content, n = re.subn(pattern, replacement, content)
    if n > 0:
        PAGE.write_text(new_content, encoding="utf-8")
        print(f"\n  ✅ select フィールド追加（regex）完了")
        fixed = True
    else:
        # 最終手段: rows.map を (rows as any[]).map に変更してキャスト
        old_map = "  const estimates = rows.map((r) => ({"
        new_map = "  const estimates = (rows as any[]).map((r) => ({"
        if old_map in content:
            content = content.replace(old_map, new_map, 1)
            PAGE.write_text(content, encoding="utf-8")
            print(f"\n  ✅ rows を as any[] キャストで型エラー回避")
            fixed = True
        else:
            print("\n  ❌ 全パターン不一致。select ブロックを手動で確認してください")

# tsc チェック
print("\n[TypeScript チェック]")
r = subprocess.run(["npx","tsc","--noEmit"], cwd=ROOT, capture_output=True, text=True)
if r.returncode == 0:
    print("  ✅ tsc --noEmit: エラーなし")
    print("""
次のコマンドを実行:
git add -A && git commit -m 'feat: Phase6 見積一覧 ソート/Draft絞込/住所/URLパラメータ保持'
git push
""")
else:
    print(f"  ❌ tsc エラー:\n{r.stdout}{r.stderr}")

print("=" * 60)
