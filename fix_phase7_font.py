#!/usr/bin/env python3
"""
fix_phase7_font.py  企業コード等幅フォント残件修正
"""
import subprocess
from pathlib import Path

ROOT = Path.home() / "projects" / "ochi-ss"
PAGE = ROOT / "src/app/(auth)/login/page.tsx"

content = PAGE.read_text(encoding="utf-8")

OLD = 'className="w-full h-11 px-4 text-[15px] border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A4080]/30 focus:border-[#1A4080] transition-colors placeholder:text-[#C4C9D4] disabled:bg-gray-50"\n                disabled={isLoading}\n              />'
NEW = 'className="w-full h-11 px-4 text-[15px] border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A4080]/30 focus:border-[#1A4080] transition-colors placeholder:text-[#C4C9D4] disabled:bg-gray-50 font-mono tracking-[0.2em] text-center"\n                disabled={isLoading}\n              />'

# companyCode の input は最初に登場する該当 className
if OLD in content:
    # 最初の1件だけ置換（companyCode の input のみ）
    content = content.replace(OLD, NEW, 1)
    PAGE.write_text(content, encoding="utf-8")
    print("  ✅ 企業コード: font-mono/tracking 適用")
else:
    # フォールバック: autoComplete="organization" を含む input を探して className 末尾に追加
    old_org = 'autoComplete="organization"\n                className="w-full h-11 px-4 text-[15px] border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A4080]/30 focus:border-[#1A4080] transition-colors placeholder:text-[#C4C9D4] disabled:bg-gray-50"'
    new_org = 'autoComplete="organization"\n                className="w-full h-11 px-4 text-[15px] border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A4080]/30 focus:border-[#1A4080] transition-colors placeholder:text-[#C4C9D4] disabled:bg-gray-50 font-mono tracking-[0.2em] text-center"'
    if old_org in content:
        content = content.replace(old_org, new_org, 1)
        PAGE.write_text(content, encoding="utf-8")
        print("  ✅ 企業コード: font-mono/tracking 適用（fallback）")
    else:
        print("  ❌ パターン不一致。周辺コードを出力:")
        idx = content.find('autoComplete="organization"')
        if idx >= 0:
            print(repr(content[idx-200:idx+300]))
        raise SystemExit(1)

r = subprocess.run(["npx","tsc","--noEmit"], cwd=ROOT, capture_output=True, text=True)
if r.returncode == 0:
    print("  ✅ tsc --noEmit: エラーなし")
    print("""
git add -A && git commit -m "fix: Phase7 企業コード等幅フォント適用"
git push
""")
else:
    print(f"  ❌ tsc エラー:\n{r.stdout}{r.stderr}")
