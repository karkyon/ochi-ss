import subprocess, os

def run(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return (r.stdout + r.stderr).strip()

print("=" * 60)
print("=== VPN詳細診断 ===")
print("=" * 60)

print("\n[1] vpn-ochisrv の詳細設定確認")
print(run("nmcli con show vpn-ochisrv 2>&1"))

print("\n[2] NetworkManager VPN接続設定ファイル確認")
print(run("sudo cat /etc/NetworkManager/system-connections/vpn-ochisrv.nmconnection 2>/dev/null || "
          "sudo cat /etc/NetworkManager/system-connections/vpn-ochisrv 2>/dev/null || "
          "echo '(ファイルが見つかりません)'"))

print("\n[3] NetworkManager対応VPNプラグイン確認")
print(run("dpkg -l | grep -iE 'network-manager.*vpn|nm-.*vpn|openfortivpn|fortivpn' | awk '{print $2,$3}' || echo '(なし)'"))
print(run("ls /usr/lib/NetworkManager/ 2>/dev/null | grep vpn || echo '(VPNプラグインなし)'"))
print(run("ls /usr/lib/x86_64-linux-gnu/NetworkManager/ 2>/dev/null | grep vpn || echo '(なし)'"))

print("\n[4] openfortivpn インストール可否確認")
print(run("apt-cache show openfortivpn 2>/dev/null | grep -E 'Package|Version' | head -3 || echo '(パッケージなし)'"))
print(run("apt-cache show network-manager-openfortivpn 2>/dev/null | grep -E 'Package|Version' | head -3 || echo '(パッケージなし)'"))
print(run("apt-cache show network-manager-fortisslvpn 2>/dev/null | grep -E 'Package|Version' | head -3 || echo '(パッケージなし)'"))

print("\n[5] /etc/NetworkManager/system-connections/ 全リスト")
print(run("sudo ls -la /etc/NetworkManager/system-connections/ 2>/dev/null"))

print("\n[6] vpn-ochisrv のVPN種別確認")
print(run("sudo grep -i 'service-type\\|type\\|gateway\\|host\\|user\\|vpn-type' "
          "/etc/NetworkManager/system-connections/vpn-ochisrv* 2>/dev/null || "
          "nmcli -f VPN.TYPE,VPN.DATA con show vpn-ochisrv 2>/dev/null || echo '(確認失敗)'"))

print("\n" + "=" * 60)
print("=== 診断完了 ===")
