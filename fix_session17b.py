#!/usr/bin/env python3
"""fix_session17b.py — estimates/page.tsx draft 重複削除"""
import subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def rep(p, old, new, label):
    path = ROOT / p
    c = path.read_text(encoding="utf-8")
    if old not in c: print(f"  ❌ [{label}] 未発見"); return False
    path.write_text(c.replace(old, new, 1), encoding="utf-8"); print(f"  ✅ [{label}]"); return True

def main():
    print("fix_session17b.py 開始")

    # 重複 draft エントリを削除
    rep(
        "src/app/(app)/estimates/page.tsx",
        '  draft:     { label: "下書き",   color: "bg-gray-100 text-gray-600" },\n  draft:     { label: "下書き",  color: "bg-gray-100 text-gray-600" },\n    saved:',
        '  draft:     { label: "下書き",   color: "bg-gray-100 text-gray-600" },\n  saved:',
        "draft重複削除"
    )

    print("→ tscチェック中...")
    r = subprocess.run(["npx", "tsc", "--noEmit"], capture_output=True, text=True, cwd=str(ROOT))
    if r.returncode != 0:
        print("❌ tscエラー:"); print((r.stdout + r.stderr)[-4000:]); sys.exit(1)

    print("✅ tscエラーなし → git add & push")
    subprocess.run(["git", "add", "-A"], check=True, cwd=str(ROOT))
    subprocess.run(["git", "commit", "-m", "fix: estimates/page.tsx draft重複キー削除"], check=True, cwd=str(ROOT))
    subprocess.run(["git", "push"], check=True, cwd=str(ROOT))
    print("✅ push完了")

if __name__ == "__main__":
    main()
