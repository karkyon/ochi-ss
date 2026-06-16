#!/usr/bin/env python3
"""
fix_migration.py
マイグレーション順序問題修正 + DB適用

配置: ~/projects/ochi-ss/fix_migration.py
実行: cd ~/projects/ochi-ss && python3 fix_migration.py
"""
import os, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))

def run(cmd):
    r = subprocess.run(cmd, shell=True, cwd=ROOT, capture_output=True, text=True)
    return r.returncode, r.stdout, r.stderr

def main():
    print("=== fix_migration.py ===\n")

    # 1. 最新コード取得
    print("[1] git pull...")
    code, out, err = run("git pull origin main 2>&1")
    print(f"  {(out+err).strip()[:150]}")

    # 2. 失敗したマイグレーションをDBからリセット
    print("\n[2] 失敗マイグレーション(20260616000000_rls)をDBからリセット...")
    code, out, err = run("npx prisma migrate resolve --rolled-back 20260616000000_rls 2>&1")
    msg = (out + err).strip()
    print(f"  {msg[:200]}")
    # エラーでも続行 (既にリセット済みの場合もあるため)

    # 3. 新マイグレーション適用
    print("\n[3] prisma migrate deploy (AuditLog + RLS)...")
    code, out, err = run("npx prisma migrate deploy 2>&1")
    msg = (out + err).strip()
    print(msg[:600])
    if code != 0 and "error" in msg.lower():
        print("\n❌ migrate deploy 失敗")
        print("手動確認: npx prisma migrate status")
        sys.exit(1)
    print("  ✅ migrate deploy 成功")

    # 4. Prismaクライアント再生成
    print("\n[4] Prismaクライアント再生成...")
    code, out, err = run("npx prisma generate 2>&1")
    print(f"  {(out+err).strip()[:150]}")

    # 5. 自己削除
    self_path = os.path.abspath(__file__)
    if os.path.exists(self_path):
        os.remove(self_path)
    print(f"  自己削除: {self_path}")

    print("""
✅ 完了!

最後に Next.js を再起動:
  sudo systemctl restart ochi-web.service

動作確認:
  curl -s http://localhost:3050/api/v1/estimates \\
    -H "Cookie: <セッションCookie>" | head -c 200
""")

if __name__ == "__main__":
    main()
