import subprocess, os, sys

ROOT = os.path.expanduser("~/projects/ochi-ss")
os.chdir(ROOT)

def run(cmd, check=True):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if check and r.returncode != 0:
        print(f"ERROR:\n{r.stdout}\n{r.stderr}")
        sys.exit(1)
    return r.stdout.strip()

print("=== fix_shiagari_map_and_sqlserver.py ===")
print("[1] git pull...")
print(" ", run("git pull").split("\n")[0])

# ────────────────────────────────────────────────
# [2] WO加工仕様マップ修正（EstimateNewClient.tsx）
# ────────────────────────────────────────────────
# 添付SSのWO加工仕様テーブル実データ:
# コード2  : T=2(W),  A=2(W),  B=2(W)  → 6F     全面W
# コード4  : T=1(RG), A=4(〜), B=4(〜) → 2F2G   T面RG, A/B面なし
# コード5  : T=1(RG), A=4(〜), B=2(W)  → 4F2G   T面RG, A面なし, B面W
# コード7  : T=1(RG), A=2(W),  B=2(W)  → 6F2G   T面RG, A/B面W
# コード8  : T=2(W),  A=1(RG), B=2(W)  → 6F2G   T面W,  A面RG, B面W
# コード9  : T=2(W),  A=2(W),  B=1(RG) → 6F2G   T面W,  A面W,  B面RG
# コード10 : T=2(W),  A=4(〜), B=2(W)  → 4F     T面W,  A面なし, B面W
# コード11 : T=2(W),  A=4(〜), B=4(〜) → 2F     T面W,  A/B面なし
# コード12 : T=4(〜), A=1(RG), B=4(〜) → 2F2G   A面RG, T/B面なし
# コード13 : T=4(〜), A=4(〜), B=1(RG) → 2F2G   B面RG, T/A面なし
# コード14 : T=4(〜), A=2(W),  B=1(RG) → 4F2G   A面W, B面RG, T面なし
# コード15 : T=4(〜), A=4(〜), B=2(W)  → 2F     B面W, T/A面なし
# コード16 : T=4(〜), A=4(〜), B=4(〜) → 黒皮   全面なし
# コード17 : T=5(SG), A=2(W),  B=2(W)  → 6F2SG
# コード20 : T=4(〜), A=2(W),  B=4(〜) → 4F
# コード22 : T=2(W),  A=5(SG), B=2(W)  → 6F2SG
# コード23 : T=2(W),  A=2(W),  B=5(SG) → 6F2SG
# 加工指示コード: 1=RG, 2=W, 4=〜(なし), 5=SG
#
# → 仕上り名のデフォルトは6F(コード2)=W/W/W が正解
# → 6F2G は複数パターン存在し、全面確定できないため加工仕様欄で要確認

TARGET = f"{ROOT}/src/app/(app)/estimates/new/EstimateNewClient.tsx"

OLD_MAP = '''// ─── WO加工仕様マップ（添付SSデータより実装） ────────────────
// 仕上り名 → 加工指示(T/A/B) のデフォルト対応
// 加工指示コード文字列: "W"=平研削, "G"=研削, "〜"=なし(ランダム面), "RG"=両面研削, "SG"=ショット
// 添付SS: 加工仕様コード2=6F(W/W/W), 7=6F2G(W/W/W), 8=6F2G(W/W/W)等
const SHIAGARI_CUT_MAP: Record<string, { t: string; a: string; b: string }> = {
  "6F":    { t: "W",  a: "W",  b: "W"  },  // 6面フライス: 全面W
  "6F2G":  { t: "W",  a: "W",  b: "W"  },  // 6面フライス+2面研削: W/W/W
  "4F2G":  { t: "W",  a: "W",  b: "W"  },
  "2F2G":  { t: "W",  a: "W",  b: "W"  },
  "6F2SG": { t: "W",  a: "W",  b: "W"  },
  "4F2SG": { t: "W",  a: "W",  b: "W"  },
  "4F":    { t: "W",  a: "〜", b: "〜" },  // 4面フライス: T面のみW
  "2F":    { t: "W",  a: "〜", b: "W"  },  // 2面フライス
  "黒皮":  { t: "〜", a: "〜", b: "〜" },  // 未加工
}

// 仕上り名から加工指示を解決（完全一致 → 部分一致 → デフォルトW/W/W）
function resolveCutCodes(specName: string): { t: string; a: string; b: string } {
  if (SHIAGARI_CUT_MAP[specName]) return SHIAGARI_CUT_MAP[specName]
  for (const [key, val] of Object.entries(SHIAGARI_CUT_MAP)) {
    if (specName.startsWith(key)) return val
  }
  return { t: "W", a: "W", b: "W" }
}

// 加工指示が全面確定（〜なし）かどうか
function allCutsDefined(cuts: { t: string; a: string; b: string }): boolean {
  return cuts.t !== "〜" && cuts.a !== "〜" && cuts.b !== "〜"
}'''

NEW_MAP = '''// ─── WO加工仕様マップ（添付SSのWO加工仕様テーブル実データ準拠） ──
// 加工指示コード: 1=RG, 2=W, 4=〜(なし/ランダム面), 5=SG
// ※ 6F2G等は複数の加工指示パターンが存在するため「デフォルト」のみ定義
//   実際の加工指示は仕上り選択後にユーザーが加工仕様欄で確認・変更する
const SHIAGARI_CUT_MAP: Record<string, { t: string; a: string; b: string }> = {
  // コード2: T=W, A=W, B=W
  "6F":    { t: "W",  a: "W",  b: "W"  },
  // コード7: T=RG, A=W, B=W（最も一般的な6F2Gパターン）
  "6F2G":  { t: "RG", a: "W",  b: "W"  },
  // コード5: T=RG, A=〜, B=W
  "4F2G":  { t: "RG", a: "〜", b: "W"  },
  // コード4: T=RG, A=〜, B=〜
  "2F2G":  { t: "RG", a: "〜", b: "〜" },
  // コード17: T=SG, A=W, B=W
  "6F2SG": { t: "SG", a: "W",  b: "W"  },
  // コード10: T=W, A=〜, B=W
  "4F":    { t: "W",  a: "〜", b: "W"  },
  // コード11: T=W, A=〜, B=〜
  "2F":    { t: "W",  a: "〜", b: "〜" },
  // コード16: T=〜, A=〜, B=〜
  "黒皮":  { t: "〜", a: "〜", b: "〜" },
}

// 仕上り名から加工指示を解決（完全一致 → 前方部分一致 → デフォルト6F=W/W/W）
function resolveCutCodes(specName: string): { t: string; a: string; b: string } {
  if (SHIAGARI_CUT_MAP[specName]) return SHIAGARI_CUT_MAP[specName]
  // "6F2G(特殊)" 等の前方一致
  for (const key of Object.keys(SHIAGARI_CUT_MAP)) {
    if (specName.startsWith(key)) return SHIAGARI_CUT_MAP[key]
  }
  return { t: "W", a: "W", b: "W" }
}

// 加工指示が全面確定（〜なし）かどうか → ENTERで寸法Tへスキップ判定
function allCutsDefined(cuts: { t: string; a: string; b: string }): boolean {
  return cuts.t !== "〜" && cuts.a !== "〜" && cuts.b !== "〜"
}'''

print("[2] WO加工仕様マップ修正...")
with open(TARGET, "r", encoding="utf-8") as f:
    content = f.read()

if OLD_MAP in content:
    content = content.replace(OLD_MAP, NEW_MAP)
    print("  マップ置換OK")
else:
    print("  ERROR: 対象テキストが見つかりません")
    sys.exit(1)

with open(TARGET, "w", encoding="utf-8") as f:
    f.write(content)
print(f"  OK: {TARGET}")

# ────────────────────────────────────────────────
# [3] .env に SQLSERVER_CONNECTION_STRING 追記確認
# ────────────────────────────────────────────────
print("[3] SQL Server接続設定確認...")
env_path = f"{ROOT}/.env"
with open(env_path, "r") as f:
    env_content = f.read()

if "SQLSERVER_CONNECTION_STRING" in env_content:
    print("  SQLSERVER_CONNECTION_STRING は既に設定済み")
    # 現在の値を表示（パスワードをマスク）
    for line in env_content.splitlines():
        if "SQLSERVER_CONNECTION_STRING" in line:
            # パスワード部分をマスク
            import re
            masked = re.sub(r'Password=[^;]+', 'Password=****', line)
            print(f"  現在値: {masked}")
else:
    print("  SQLSERVER_CONNECTION_STRING 未設定")
    print()
    print("  ▼▼▼ 手動で以下を .env に追記してください ▼▼▼")
    print()
    print("  # SQL Server接続設定（legacy system)")
    print("  # SSMSの接続先に合わせて変更してください")
    print("  # 例: 同一サーバー上のSQL Server")
    print("  SQLSERVER_CONNECTION_STRING=\"Server=192.168.1.11,1433;Database=ochidb_dev;User Id=<ユーザー名>;Password=<パスワード>;Encrypt=false;TrustServerCertificate=true;\"")
    print()
    print("  nano ~/.projects/ochi-ss/.env  # で編集できます")
    print()

# ────────────────────────────────────────────────
# [4] tsc check
# ────────────────────────────────────────────────
print("[4] tsc チェック...")
r = subprocess.run("npx tsc --noEmit 2>&1", shell=True, capture_output=True, text=True, cwd=ROOT)
lines = [l for l in (r.stdout + r.stderr).splitlines()
         if "error TS" in l and "node_modules" not in l and ".next" not in l and "Downloads" not in l]
if lines:
    print("  tscエラー:")
    for l in lines:
        print("   ", l)
    sys.exit(1)
print("  ✅ 実コードエラー0件")

# ────────────────────────────────────────────────
# [5] git commit & push
# ────────────────────────────────────────────────
print("[5] git commit & push...")
run("git add -A")
r = subprocess.run(
    'git commit -m "fix: WO加工仕様マップをSSデータ通りに修正（6F2G=RG/W/W等）"',
    shell=True, capture_output=True, text=True, cwd=ROOT)
print(" ", r.stdout.strip().split("\n")[0])
run("git push")
print("  PUSH OK")

# 自身を削除
os.remove(__file__)
print(f"  削除: {__file__}")

print()
print("✅ コード修正完了!")
print()
print("─" * 60)
print("【SQL Server接続設定】")
print("─" * 60)
print()
print("サーバーの ~/.projects/ochi-ss/.env に以下を追記:")
print()
print('SQLSERVER_CONNECTION_STRING="Server=<SQLServer_IP>,1433;')
print('Database=<DB名>;User Id=<ユーザー>;Password=<パスワード>;')
print('Encrypt=false;TrustServerCertificate=true;"')
print()
print("SSMSの接続情報:")
print("  サーバー名:  10.1.103.164  (または 192.168.1.11)")
print("  DB名:        ochidb_dev    (または 実際のDB名)")
print("  ユーザー:    jade           (または 実際のユーザー名)")
print("  パスワード:  RTW65b         (または 実際のパスワード)")
print()
print("追記後: sudo systemctl restart ochi-web.service")
