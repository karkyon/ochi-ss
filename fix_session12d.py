#!/usr/bin/env python3
"""
fix_session12d.py — EstimateEditClient tscエラー完全修正
- interface Props に estimateId?: string 追加
- export default function の引数に estimateId 追加
"""

import subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def rep(p, old, new, label):
    path = ROOT / p
    c = path.read_text(encoding="utf-8")
    if old not in c:
        print(f"  ❌ [{label}] アンカー未発見")
        return False
    path.write_text(c.replace(old, new, 1), encoding="utf-8")
    print(f"  ✅ [{label}]")
    return True

def main():
    print("=" * 60)
    print("fix_session12d.py 開始")
    print("=" * 60)

    # FIX 1: interface Props に estimateId 追加
    rep(
        "src/app/(app)/estimates/[id]/edit/EstimateEditClient.tsx",
        """\
interface Props {
  estimateData:   EstimateData
  materials:      Material[]
  processingSpecs: ProcessingSpec[]
  userInfo: {
    customerCode: string
    customerName: string
    chargeName:   string
    userId:       string
  }
}""",
        """\
interface Props {
  estimateId?:    string
  estimateData:   EstimateData
  materials:      Material[]
  processingSpecs: ProcessingSpec[]
  userInfo: {
    customerCode: string
    customerName: string
    chargeName:   string
    userId:       string
  }
}""",
        "Props に estimateId 追加"
    )

    # FIX 2: export default function の引数に estimateId 追加
    rep(
        "src/app/(app)/estimates/[id]/edit/EstimateEditClient.tsx",
        "export default function EstimateEditClient({ estimateData, materials, processingSpecs, userInfo }: Props) {",
        "export default function EstimateEditClient({ estimateId, estimateData, materials, processingSpecs, userInfo }: Props) {",
        "関数引数に estimateId 追加"
    )

    print("\n→ tscチェック中...")
    result = subprocess.run(["npx", "tsc", "--noEmit"], capture_output=True, text=True, cwd=str(ROOT))
    if result.returncode != 0:
        print("❌ tscエラー:")
        print((result.stdout + result.stderr)[-6000:])
        sys.exit(1)

    print("✅ tscエラーなし → git add & push")
    subprocess.run(["git", "add", "-A"], check=True, cwd=str(ROOT))
    subprocess.run(["git", "commit", "-m",
        "fix: EstimateEditClient Props/引数にestimateId追加 tscエラー解消"],
        check=True, cwd=str(ROOT))
    subprocess.run(["git", "push"], check=True, cwd=str(ROOT))
    print("✅ push完了")

if __name__ == "__main__":
    main()
