import subprocess, os

def run(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return (r.stdout + r.stderr).strip()

print("=" * 60)
print("=== Ochi-ss バックエンド診断 ===")
print("=" * 60)

print("\n[1] systemd サービス状態")
for svc in ["ochi-web.service", "ochi-infra.service"]:
    out = run(f"systemctl is-active {svc}")
    status = run(f"systemctl status {svc} --no-pager -l | head -20")
    print(f"\n--- {svc}: {out} ---")
    print(status)

print("\n[2] Dockerコンテナ状態")
print(run("cd ~/projects/ochi-ss/docker && docker compose ps 2>&1"))

print("\n[3] ポート使用状況 (3050/5455/6479)")
print(run("ss -tlnp | grep -E '3050|5455|6479' || echo '(該当なし)'"))

print("\n[4] Next.js プロセス確認")
print(run("ps aux | grep -E 'node|next' | grep -v grep | head -10 || echo '(プロセスなし)'"))

print("\n[5] ochi-web 直近ログ (50行)")
print(run("journalctl -u ochi-web.service -n 50 --no-pager 2>&1"))

print("\n[6] pre-check API 疎通確認")
print(run("curl -s -w '\\nHTTP_STATUS:%{http_code}' -X POST http://localhost:3050/api/v1/auth/pre-check "
          "-H 'Content-Type: application/json' "
          "-d '{\"companyCode\":\"99999\",\"userId\":\"karkyon\",\"password\":\"jun8206\"}' 2>&1"))

print("\n[7] PostgreSQL 接続確認")
print(run("cd ~/projects/ochi-ss && npx prisma db execute --stdin <<< 'SELECT 1 as ok' 2>&1 | head -5"))

print("\n" + "=" * 60)
print("=== 診断完了 ===")
