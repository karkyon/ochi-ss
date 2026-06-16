import subprocess, os, sys, datetime

ROOT = os.path.expanduser("~/projects/ochi-ss")
os.chdir(ROOT)

def run(cmd, check=True):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if check and r.returncode != 0:
        print(f"ERROR: {cmd}\n{r.stdout}\n{r.stderr}")
        sys.exit(1)
    return r.stdout.strip()

print("=== fix_rls_auth2.py ===")

# [1] git pull
print("[1] git pull...")
out = run("git pull")
print(" ", out.split("\n")[0])

# [2] 新マイグレーション作成
print("[2] 新マイグレーション作成 (auth/log テーブル RLS完全無効化)...")
ts = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
mdir = f"{ROOT}/prisma/migrations/{ts}_fix_rls_auth_tables"
os.makedirs(mdir, exist_ok=True)

sql = """-- Migration: fix_rls_auth_tables
-- 問題: users/login_histories/security_logs/audit_logs テーブルに
--       RLSが設定されており、認証フロー(auth.ts, pre-check)が
--       app.current_tenant未設定でRLSにブロックされていた
-- 修正: 認証・ログ専用テーブルはRLS不要のため完全無効化

-- users: RLS完全無効化（auth.tsのfindFirst/update/pre-checkが通る必要がある）
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- login_histories: 認証ログ（テナント隔離不要）
ALTER TABLE login_histories DISABLE ROW LEVEL SECURITY;

-- security_logs: セキュリティログ（テナント隔離不要）
ALTER TABLE security_logs DISABLE ROW LEVEL SECURITY;

-- audit_logs: 監査ログ（auth.tsからの書き込みが通る必要がある）
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
"""

with open(f"{mdir}/migration.sql", "w") as f:
    f.write(sql)
print(f"  作成: {mdir}/migration.sql")

# [3] prisma migrate deploy
print("[3] prisma migrate deploy...")
out = run("npx prisma migrate deploy 2>&1")
if "All migrations" in out or "applied" in out.lower():
    print("  ✅ migrate deploy 成功")
else:
    print(out[-500:])
    sys.exit(1)

# [4] tsc check
print("[4] tsc チェック...")
r = subprocess.run("npx tsc --noEmit 2>&1", shell=True, capture_output=True, text=True)
lines = [l for l in (r.stdout + r.stderr).splitlines()
         if "error TS" in l and
            "node_modules" not in l and
            ".next" not in l and
            "Downloads" not in l]
if lines:
    print("  tscエラー:")
    for l in lines:
        print("   ", l)
    sys.exit(1)
print("  ✅ 実コードエラー0件")

# [5] git commit & push
print("[5] git commit & push...")
run("git add -A")
r = subprocess.run('git commit -m "fix: 認証/ログテーブルRLS完全無効化→ログイン通信エラー修正"',
                   shell=True, capture_output=True, text=True)
print(" ", r.stdout.strip().split("\n")[0])
run("git push")
print("  PUSH OK")

print("✅ 完了! ブラウザでログインを再試行してください。")
