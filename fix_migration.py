#!/usr/bin/env python3
"""
fix_migration.py — マイグレーション完全修復

配置: ~/projects/ochi-ss/fix_migration.py
実行: cd ~/projects/ochi-ss && python3 fix_migration.py
"""
import os, subprocess, sys, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))

def write(path, content):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  書込: {path}")

def run(cmd):
    r = subprocess.run(cmd, shell=True, cwd=ROOT, capture_output=True, text=True)
    return r.returncode, r.stdout, r.stderr

AUDIT_LOG_SQL = """\
-- Migration: 20260616000001_add_audit_log
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id"          TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "user_id"     TEXT NOT NULL,
    "action"      TEXT NOT NULL,
    "resource"    TEXT NOT NULL,
    "resource_id" TEXT,
    "ip_address"  TEXT,
    "user_agent"  TEXT,
    "result_code" INTEGER NOT NULL DEFAULT 200,
    "detail"      JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_audit_logs_tenant_date" ON "audit_logs"("customer_id","occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_audit_logs_user_date"   ON "audit_logs"("user_id","occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_audit_logs_resource"    ON "audit_logs"("resource","resource_id");
"""

RLS_SQL = """\
-- Migration: 20260616000002_rls_policies
ALTER TABLE estimate_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_headers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON estimate_headers;
CREATE POLICY tenant_isolation ON estimate_headers
  USING (customer_id::text = current_setting('app.current_tenant', true)
         OR current_setting('app.is_super_admin', true) = 'true')
  WITH CHECK (customer_id::text = current_setting('app.current_tenant', true));

ALTER TABLE estimate_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_details FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON estimate_details;
CREATE POLICY tenant_isolation ON estimate_details
  USING (estimate_header_id IN (
           SELECT id FROM estimate_headers
           WHERE customer_id::text = current_setting('app.current_tenant', true))
         OR current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON orders;
CREATE POLICY tenant_isolation ON orders
  USING (customer_id::text = current_setting('app.current_tenant', true)
         OR current_setting('app.is_super_admin', true) = 'true')
  WITH CHECK (customer_id::text = current_setting('app.current_tenant', true));

ALTER TABLE direct_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_deliveries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON direct_deliveries;
CREATE POLICY tenant_isolation ON direct_deliveries
  USING (customer_id::text = current_setting('app.current_tenant', true)
         OR current_setting('app.is_super_admin', true) = 'true')
  WITH CHECK (customer_id::text = current_setting('app.current_tenant', true));

ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_reads FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON notification_reads;
CREATE POLICY tenant_isolation ON notification_reads
  USING (customer_id::text = current_setting('app.current_tenant', true)
         OR current_setting('app.is_super_admin', true) = 'true')
  WITH CHECK (customer_id::text = current_setting('app.current_tenant', true));

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON users;
CREATE POLICY tenant_isolation ON users
  USING (customer_id::text = current_setting('app.current_tenant', true)
         OR current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON audit_logs;
CREATE POLICY tenant_isolation ON audit_logs
  USING (customer_id::text = current_setting('app.current_tenant', true)
         OR current_setting('app.is_super_admin', true) = 'true')
  WITH CHECK (customer_id::text = current_setting('app.current_tenant', true));

CREATE INDEX IF NOT EXISTS idx_estimate_headers_tenant_status
  ON estimate_headers(customer_id, estimate_status) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_estimate_headers_tenant_date
  ON estimate_headers(customer_id, estimate_date DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status
  ON orders(customer_id, order_status) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_direct_deliveries_tenant
  ON direct_deliveries(customer_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_notification_reads_tenant
  ON notification_reads(customer_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant
  ON users(customer_id) WHERE is_deleted = false;
"""

def main():
    print("=== fix_migration.py ===\n")

    # 1. .gitignore から prisma/migrations 行を削除
    print("[1] .gitignore 修正...")
    gi_path = os.path.join(ROOT, ".gitignore")
    with open(gi_path) as f:
        lines = f.readlines()
    new_lines = [l for l in lines if "prisma/migrations" not in l]
    if len(new_lines) < len(lines):
        with open(gi_path, "w") as f:
            f.writelines(new_lines)
        print("  prisma/migrations/ の除外行を削除")
    else:
        print("  既に修正済み")

    # 2. サーバー上の全 migrations ディレクトリを確認・整理
    print("\n[2] prisma/migrations/ の状態確認...")
    mig_dir = os.path.join(ROOT, "prisma/migrations")
    if os.path.exists(mig_dir):
        existing = sorted(os.listdir(mig_dir))
        print(f"  存在するディレクトリ: {existing}")
        # 古い壊れたディレクトリを削除
        for d in existing:
            if d == "20260616000000_rls":
                target = os.path.join(mig_dir, d)
                shutil.rmtree(target)
                print(f"  削除: {d}")
    else:
        print("  migrations/ ディレクトリが存在しません — 作成します")

    # 3. 正しいマイグレーションを作成
    print("\n[3] 正しいマイグレーション作成...")
    write("prisma/migrations/20260616000001_add_audit_log/migration.sql", AUDIT_LOG_SQL)
    write("prisma/migrations/20260616000002_rls_policies/migration.sql", RLS_SQL)

    # 4. DB上の失敗レコードをリセット (エラーは無視して続行)
    print("\n[4] DB上の失敗マイグレーションレコードをリセット...")
    for name in ["20260616000000_rls", "20260616000001_add_audit_log", "20260616000002_rls_policies"]:
        code, out, err = run(f"npx prisma migrate resolve --rolled-back {name} 2>&1")
        msg = (out + err).strip()
        # 成功/失敗問わず状態行だけ表示
        for line in msg.splitlines():
            if any(k in line for k in ["Migration", "migration", "Error", "error", "rolled"]):
                print(f"  [{name[:30]}] {line.strip()}")
                break

    # 5. migrate deploy
    print("\n[5] prisma migrate deploy...")
    code, out, err = run("npx prisma migrate deploy 2>&1")
    msg = (out + err).strip()
    print(msg[:1000])
    if code != 0:
        print("\n❌ migrate deploy 失敗")
        print("\n--- デバッグ: migrate status ---")
        _, s_out, s_err = run("npx prisma migrate status 2>&1")
        print((s_out + s_err)[:800])
        sys.exit(1)
    print("  ✅ migrate deploy 成功")

    # 6. Prismaクライアント再生成
    print("\n[6] prisma generate...")
    run("npx prisma generate 2>&1")

    # 7. git push
    print("\n[7] git commit & push...")
    run("git add -A")
    code, out, err = run('git commit -m "fix: migrations git管理化 + 2段階マイグレーション(audit_log→RLS)"')
    msg = (out + err).strip()
    print(f"  {msg[:100]}")
    if "nothing to commit" not in msg:
        code2, out2, err2 = run("git push origin main")
        print(f"  {'PUSH OK' if code2 == 0 else (out2+err2)[:200]}")

    # 自己削除
    sp = os.path.abspath(__file__)
    if os.path.exists(sp):
        os.remove(sp)

    print("""
✅ 完了!
  sudo systemctl restart ochi-web.service
""")

if __name__ == "__main__":
    main()
