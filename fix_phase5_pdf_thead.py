#!/usr/bin/env python3
"""
fix_phase5_pdf_thead.py  注文書PDF thead ヘッダー列追加（残件修正）
"""
import subprocess
from pathlib import Path

ROOT = Path.home() / "projects" / "ochi-ss"
ORDER_PDF = ROOT / "src/app/api/v1/orders/[id]/pdf/route.ts"

content = ORDER_PDF.read_text(encoding="utf-8")

OLD = """    <thead><tr>
      <th style="width:3%">No</th>
      <th style="width:12%">材料</th>
      <th style="width:10%">加工仕様</th>
      <th style="width:15%">寸法T×A×B</th>
      <th style="width:6%">数量</th>
      <th style="width:10%">単価</th>
      <th style="width:11%">金額</th>
      <th style="width:10%">最短納期</th>
    </tr></thead>"""

NEW = """    <thead><tr>
      <th style="width:3%">No</th>
      <th style="width:10%">材料</th>
      <th style="width:8%">加工仕様</th>
      <th style="width:10%">寸法T×A×B</th>
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
      <th style="width:8%">最短納期</th>
    </tr></thead>"""

if OLD in content:
    ORDER_PDF.write_text(content.replace(OLD, NEW, 1), encoding="utf-8")
    print("  ✅ 注文PDF: theadヘッダー列追加")
else:
    # 現在のtheadを出力して確認
    start = content.find("<thead>")
    end   = content.find("</thead>") + 8
    print("  ❌ パターン不一致。現在のthead:")
    print(content[start:end])
    raise SystemExit(1)

# tsc チェック
r = subprocess.run(["npx","tsc","--noEmit"], cwd=ROOT, capture_output=True, text=True)
if r.returncode == 0:
    print("  ✅ tsc --noEmit: エラーなし")
    print("""
次のコマンドを実行:
git add -A && git commit -m "fix: Phase5 注文書PDF theadヘッダー列追加"
git push
""")
else:
    print(f"  ❌ tsc エラー:\n{r.stdout}{r.stderr}")
