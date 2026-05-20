#!/usr/bin/env python3
"""
fix_phase9_cancel_btn.py  注文詳細ページ キャンセルボタン残件修正
"""
import subprocess
from pathlib import Path

ROOT = Path.home() / "projects" / "ochi-ss"
PAGE = ROOT / "src/app/(app)/orders/[id]/page.tsx"

content = PAGE.read_text(encoding="utf-8")

# 実際のパターン確認
OLD = '          <Link href={`/api/v1/orders/${order.id}/pdf`} target="_blank" className="px-3 py-2 rounded-lg border border-emerald-300 text-emerald-700 text-sm hover:bg-emerald-50">🖨️ 注文書PDF</Link>'
NEW = '          <Link href={`/api/v1/orders/${order.id}/pdf`} target="_blank" className="px-3 py-2 rounded-lg border border-emerald-300 text-emerald-700 text-sm hover:bg-emerald-50">🖨️ 注文書PDF</Link>\n          {["pending", "confirmed"].includes(order.orderStatus) && (\n            <OrderCancelButton orderId={order.id} orderNo={order.orderNo ?? order.id.slice(0, 8)} />\n          )}'

if OLD in content:
    content = content.replace(OLD, NEW, 1)
    PAGE.write_text(content, encoding="utf-8")
    print("  ✅ キャンセルボタン追加")
else:
    # 実際のパターンを出力して確認
    idx = content.find("注文書PDF")
    if idx >= 0:
        print("  現在の注文書PDFボタン周辺コード:")
        print(repr(content[idx-100:idx+150]))
    # Link の href で orders pdf を含む行を全探索
    for i, line in enumerate(content.split("\n")):
        if "orders" in line and "pdf" in line and "Link" in line:
            print(f"  Line {i+1}: {repr(line)}")
    raise SystemExit(1)

r = subprocess.run(["npx","tsc","--noEmit"], cwd=ROOT, capture_output=True, text=True)
if r.returncode == 0:
    print("  ✅ tsc --noEmit: エラーなし")
    print("""
git add -A && git commit -m "fix: Phase9 注文詳細ページ キャンセルボタン追加"
git push
""")
else:
    print(f"  ❌ tsc エラー:\n{r.stdout}{r.stderr}")
