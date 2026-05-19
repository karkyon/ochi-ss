#!/usr/bin/env python3
import subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent

def rep(p, old, new, label):
    path = ROOT / p
    c = path.read_text(encoding="utf-8")
    if old not in c: print(f"  ❌ [{label}]"); return False
    path.write_text(c.replace(old, new, 1), encoding="utf-8"); print(f"  ✅ [{label}]"); return True

def main():
    print("fix_session19b.py 開始")
    rep(
        "src/app/api/v1/cutting-methods/route.ts",
        "    const specs = await prisma.processingSpec.findMany({\n      where: { isDeleted: false },",
        "    const specs = await prisma.processingSpec.findMany({\n      where: {},",
        "isDeleted削除"
    )
    print("→ tscチェック中...")
    r = subprocess.run(["npx", "tsc", "--noEmit"], capture_output=True, text=True, cwd=str(ROOT))
    if r.returncode != 0:
        print("❌ tscエラー:"); print((r.stdout + r.stderr)[-4000:]); sys.exit(1)
    print("✅ → git push")
    subprocess.run(["git", "add", "-A"], check=True, cwd=str(ROOT))
    subprocess.run(["git", "commit", "-m", "fix: ProcessingSpec isDeleted削除/cutting-methods fallback修正"], check=True, cwd=str(ROOT))
    subprocess.run(["git", "push"], check=True, cwd=str(ROOT))
    print("✅ push完了")

if __name__ == "__main__":
    main()
