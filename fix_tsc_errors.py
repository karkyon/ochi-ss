import subprocess, os, sys

ROOT = os.path.expanduser("~/projects/ochi-ss")
os.chdir(ROOT)

def run(cmd, check=True):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=ROOT)
    if check and r.returncode != 0:
        print(f"ERROR:\n{r.stdout}\n{r.stderr}")
        sys.exit(1)
    return r.stdout.strip()

print("=== fix_tsc_errors.py ===")
print("[1] git pull...")
print(" ", run("git pull").split("\n")[0])

# ─── エラー1: estimates/[id]/edit/page.tsx
# processingSpecsのmapにkakouShiji列追加
print("[2] estimates/[id]/edit/page.tsx 修正...")
edit_page = f"{ROOT}/src/app/(app)/estimates/[id]/edit/page.tsx"
with open(edit_page, "r") as f:
    content = f.read()

OLD = 'processingSpecs={processingSpecs.map(s => ({ processingSpecCode: s.processingSpecCode, processingSpecName: s.processingSpecName ?? "" }))}'
NEW = 'processingSpecs={processingSpecs.map(s => ({ processingSpecCode: s.processingSpecCode, processingSpecName: s.processingSpecName ?? "", kakouShijiT: (s as any).kakouShijiT ?? "W", kakouShijiA: (s as any).kakouShijiA ?? "W", kakouShijiB: (s as any).kakouShijiB ?? "W" }))}'

if OLD in content:
    content = content.replace(OLD, NEW)
    with open(edit_page, "w") as f:
        f.write(content)
    print("  OK")
else:
    print("  対象なし（既に修正済みか）")

# ─── エラー2: EstimateNewClient.tsx の onBlur 重複
# 郵便番号inputでonBlurを独自定義しているのに {...FH} でonBlurが上書きされる
# → {...FH}のonBlurをinputから除去し、独自onBlurを優先させる
print("[3] EstimateNewClient.tsx onBlur重複修正...")
target = f"{ROOT}/src/app/(app)/estimates/new/EstimateNewClient.tsx"
with open(target, "r") as f:
    content = f.read()

# 郵便番号inputの該当箇所: onBlurカスタム定義の後に{...FH}があり重複
# FHを展開してonFocusのみ抽出した別オブジェクトを使う
# 対象箇所を特定して修正
OLD_ZIP_INPUT = '''                <input id="f-distZip" style={{ ...INP, flex: 1 }} value={distZip}
                onChange={e => {
                  // 数字・ハイフンのみ許可
                  const v = e.target.value.replace(/[^\\d-]/g, "")
                  console.log("[郵便番号] 入力:", v)
                  setDistZip(v)
                }}
                onBlur={e => {
                  // フォーカスを外したとき整形
                  const formatted = normalizeZip(e.target.value)
                  if (formatted) { setDistZip(formatted); console.log("[郵便番号] onBlur整形:", formatted) }
                }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleZip().then(() => focusById("f-distAddr")) } }}
                placeholder="xxx-xxxx" {...FH} />'''

NEW_ZIP_INPUT = '''                <input id="f-distZip" style={{ ...INP, flex: 1 }} value={distZip}
                onChange={e => {
                  // 数字・ハイフンのみ許可
                  const v = e.target.value.replace(/[^\\d-]/g, "")
                  console.log("[郵便番号] 入力:", v)
                  setDistZip(v)
                }}
                onFocus={e => { e.target.style.background = "#ffffcc"; e.target.style.borderColor = "#f59e0b" }}
                onBlur={e => {
                  e.target.style.background = "#fff"; e.target.style.borderColor = "#cbd5e1"
                  // フォーカスを外したとき整形
                  const formatted = normalizeZip(e.target.value)
                  if (formatted) { setDistZip(formatted); console.log("[郵便番号] onBlur整形:", formatted) }
                }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleZip().then(() => focusById("f-distAddr")) } }}
                placeholder="xxx-xxxx" />'''

if OLD_ZIP_INPUT in content:
    content = content.replace(OLD_ZIP_INPUT, NEW_ZIP_INPUT)
    with open(target, "w") as f:
        f.write(content)
    print("  onBlur重複修正OK")
else:
    print("  WARNING: 対象テキストが見つかりません（改行や空白が違う可能性）")
    # フォールバック: より緩やかな検索
    import re
    # {...FH}を持つ郵便番号inputを探してFHを除去
    pattern = r'(placeholder="xxx-xxxx") \{\.\.\. ?FH\} />'
    replacement = r'\1 />'
    new_content, count = re.subn(pattern, replacement, content)
    if count > 0:
        # onFocusをonKeyDownの前に追加
        new_content = new_content.replace(
            'onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleZip().then(() => focusById("f-distAddr")) } }}\n                placeholder="xxx-xxxx" />',
            'onFocus={e => { e.target.style.background = "#ffffcc"; e.target.style.borderColor = "#f59e0b" }}\n                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleZip().then(() => focusById("f-distAddr")) } }}\n                placeholder="xxx-xxxx" />'
        )
        with open(target, "w") as f:
            f.write(new_content)
        print(f"  regex修正OK ({count}箇所)")
    else:
        print("  ERROR: 修正箇所が見つかりません")

# ─── tsc check ───
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

# ─── git commit & push ───
print("[5] git commit & push...")
run("git add -A")
r = subprocess.run(
    'git commit -m "fix: tscエラー2件修正 (edit/page.tsx ProcSpec型 + onBlur重複)"',
    shell=True, capture_output=True, text=True, cwd=ROOT)
print(" ", r.stdout.strip().split("\n")[0])
run("git push")
print("  PUSH OK")

# 自身削除
os.remove(__file__)
print(f"  削除: {__file__}")

print()
print("✅ 完了! sudo systemctl restart ochi-web.service")
print()
print("─" * 60)
print("【VPN / SQL Server接続について】")
print("─" * 60)
print("""
syncedFromSqlServer: false の原因 = VPN未接続

SQL Serverアドレス: 10.1.103.164 （過去ログより確認）
開発サーバー(omega-dev2)からVPN経由でアクセス必要

VPN接続確認コマンド:
  ping 10.1.103.164
  
もし到達できる場合は接続文字列の確認:
  Server=10.1.103.164,1433;Database=ochidb_dev;User Id=jade;Password=RTW65b;
  Encrypt=false;TrustServerCertificate=true;
  
到達できない場合 → omega-dev2でVPN(SSL-VPN/FortiClient等)の接続が必要
VPN設定はサーバー管理者に確認が必要
""")
