import subprocess, os

def run(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return (r.stdout + r.stderr).strip()

print("=" * 60)
print("=== VPN / SQL Server 接続設定 診断 ===")
print("=" * 60)

print("\n[1] SQL Server疎通確認 (10.1.103.164:1433)")
print(run("ping -c 2 -W 2 10.1.103.164 2>&1 | tail -3"))
print(run("nc -zv 10.1.103.164 1433 -w 3 2>&1 || timeout 3 bash -c 'cat < /dev/null > /dev/tcp/10.1.103.164/1433' && echo 'PORT OPEN' || echo 'PORT CLOSED/UNREACHABLE'"))

print("\n[2] VPNクライアント インストール確認")
for cmd in [
    "which openconnect 2>/dev/null || echo 'openconnect: なし'",
    "which vpnc 2>/dev/null || echo 'vpnc: なし'",
    "which forticlient 2>/dev/null || echo 'forticlient: なし'",
    "which openvpn 2>/dev/null || echo 'openvpn: なし'",
    "which openfortivpn 2>/dev/null || echo 'openfortivpn: なし'",
    "dpkg -l | grep -iE 'vpn|forti|openconnect|openvpn' 2>/dev/null | awk '{print $2,$3}' || echo '(なし)'",
]:
    print(" ", run(cmd))

print("\n[3] systemd VPNサービス確認")
print(run("systemctl list-units --type=service 2>/dev/null | grep -iE 'vpn|forti|openconnect' || echo '(VPN関連サービスなし)'"))

print("\n[4] NetworkManager VPN接続設定確認")
print(run("nmcli con show 2>/dev/null | grep -iE 'vpn|ssl|forti' || echo '(VPN接続設定なし)'"))
print(run("ls /etc/NetworkManager/system-connections/ 2>/dev/null | grep -iE 'vpn|ssl|forti' || echo '(なし)'"))

print("\n[5] /etc/vpn系設定ファイル確認")
print(run("ls /etc/vpnc/ 2>/dev/null || echo '/etc/vpnc: なし'"))
print(run("ls /etc/openvpn/ 2>/dev/null || echo '/etc/openvpn: なし'"))
print(run("ls /etc/openfortivpn/ 2>/dev/null || echo '/etc/openfortivpn: なし'"))

print("\n[6] ホームディレクトリのVPN設定確認")
print(run("find ~ -maxdepth 3 -name '*.ovpn' -o -name '*.conf' -o -name '*.pcf' 2>/dev/null | grep -iE 'vpn|forti|ssl' | head -10 || echo '(なし)'"))
print(run("ls ~/.config/forticlient/ 2>/dev/null || echo '~/.config/forticlient: なし'"))
print(run("ls ~/.fortivpn/ 2>/dev/null || echo '~/.fortivpn: なし'"))

print("\n[7] ネットワークインターフェース確認")
print(run("ip addr show | grep -E '^[0-9]+:|inet ' | head -20"))

print("\n[8] ルーティングテーブル確認（10.1.x.xへのルート）")
print(run("ip route show | grep -E '10\\.1\\.' || echo '(10.1.x.x へのルートなし)'"))

print("\n[9] /etc/hosts に SQL Server の記載があるか")
print(run("grep -iE 'ochi|10\\.1\\.103|sqlserver|ochidb' /etc/hosts 2>/dev/null || echo '(記載なし)'"))

print("\n" + "=" * 60)
print("=== 診断完了 ===")
