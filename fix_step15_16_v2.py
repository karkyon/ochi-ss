#!/usr/bin/env python3
"""
STEP15/16 残り失敗箇所修正スクリプト v2
実行: cd ~/projects/ochi-ss && python3 fix_step15_16_v2.py

修正内容:
  1. calculate/route.ts   → shortestNouki空時422回避（正確な文字列で）
  2. EstimateNewClient.tsx → HeaderForm型にzip/address/tel/fax追加
  3. EstimateNewClient.tsx → useState初期値にzip/address/tel/fax追加 + showDDModal
  4. EstimateNewClient.tsx → JSX内モーダル挿入
  5. EstimateNewClient.tsx → handleSave payloadにzip/address/tel/fax追加
"""

import os, sys, subprocess

errors = []

def fix_file(path, replacements, label):
    if not os.path.exists(path):
        errors.append(f"❌ ファイル不存在: {path}")
        return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    original = content
    for i, (old, new) in enumerate(replacements):
        if old in content:
            content = content.replace(old, new)
            print(f"  ✅ [{label}] 置換{i+1}: {old[:50].strip()}...")
        else:
            msg = f"  ❌ [{label}] 置換{i+1}失敗: {old[:50].strip()}..."
            print(msg)
            errors.append(msg)
    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  💾 [{label}] 書き込み完了")
    else:
        print(f"  ⚠ [{label}] 変更なし")

print("=" * 60)
print("Ochi-ss STEP15/16 残り修正 v2")
print("=" * 60)

# ============================================================
# 1. calculate/route.ts: shortestNouki空時422回避
#    実際のコード: if (unitPrice <= 0 || !shortestNouki) {
# ============================================================
print("\n[1] calculate/route.ts: shortestNouki空時対応")
fix_file(
    'src/app/api/v1/estimates/calculate/route.ts',
    [
        (
            '    if (unitPrice <= 0 || !shortestNouki) {\n      console.warn("[calculate] SP実行結果が不正:", { unitPrice, shortestNouki })\n      return NextResponse.json(\n        { error: "計算結果が不正です。材料コード・加工仕様・寸法を確認してください。" },\n        { status: 422 }\n      )\n    }',
            '    if (unitPrice <= 0) {\n      console.warn("[calculate] SP実行結果が不正(unitPrice<=0):", { unitPrice, shortestNouki })\n      return NextResponse.json(\n        { error: "計算結果が不正です。材料コード・加工仕様・寸法を確認してください。" },\n        { status: 422 }\n      )\n    }\n    if (!shortestNouki) {\n      console.warn("[calculate] shortestNouki が空 → 空文字で続行（SP仕様上一部組合せで返らない）")\n      // shortestNouki空でも unitPrice>0 なら計算成功とみなす\n    }'
        ),
    ],
    label="calculate/route.ts"
)

# ============================================================
# 2. EstimateNewClient.tsx: HeaderForm型にフィールド追加
# ============================================================
print("\n[2] EstimateNewClient.tsx: HeaderForm型 + useState + モーダルJSX + payload")

# 正確な型定義（プロジェクトナレッジから確認）
OLD_TYPE = '''type HeaderForm = {
  inputDate: string
  customerOrderNo: string
  endUserNo: string
  destinationCode: string
  destinationName: string
  destinationDept: string
  destinationPerson: string
  requestNouki: string
  remarks: string
}'''

NEW_TYPE = '''type HeaderForm = {
  inputDate: string
  customerOrderNo: string
  endUserNo: string
  destinationCode: string
  destinationName: string
  destinationDept: string
  destinationPerson: string
  destinationZip: string
  destinationAddress: string
  destinationTel: string
  destinationFax: string
  requestNouki: string
  remarks: string
}'''

# useState初期値（プロジェクトナレッジから確認した正確な文字列）
OLD_STATE = '''    destinationCode: "",
    destinationName: "",
    destinationDept: "",
    destinationPerson: "",
    requestNouki:    "",
    remarks:         "",
  })'''

NEW_STATE = '''    destinationCode: "",
    destinationName: "",
    destinationDept: "",
    destinationPerson: "",
    destinationZip:   "",
    destinationAddress: "",
    destinationTel:   "",
    destinationFax:   "",
    requestNouki:    "",
    remarks:         "",
  })
  const [showDDModal, setShowDDModal] = useState(false)'''

# モーダルJSX挿入位置（ヘッダー入力セクションの前）
# プロジェクトナレッジで確認: {/* ──────── ヘッダー入力 ──────── */}
OLD_MODAL_POS = '      {/* ──────── ヘッダー入力 ──────── */}'
NEW_MODAL_POS = '''      {/* 直送先検索モーダル */}
      {showDDModal && (
        <DirectDeliveryModal
          customerCode={userInfo.customerCode}
          onSelect={(dd) => {
            console.log("[直送先選択] 自動入力:", dd)
            setHeader(h => ({
              ...h,
              destinationCode:    dd.deliveryCode,
              destinationName:    dd.name,
              destinationDept:    dd.departmentName,
              destinationPerson:  dd.chargeName,
              destinationZip:     dd.postalCode,
              destinationAddress: [dd.address1, dd.address2, dd.address3].filter(Boolean).join(""),
              destinationTel:     dd.tel,
              destinationFax:     dd.fax,
            }))
          }}
          onClose={() => setShowDDModal(false)}
        />
      )}

      {/* ──────── ヘッダー入力 ──────── */}'''

# handleSave payload（プロジェクトナレッジから確認した正確な文字列）
OLD_PAYLOAD = '''        destinationPerson: header.destinationPerson || undefined,
        requestNouki:      header.requestNouki || undefined,'''

NEW_PAYLOAD = '''        destinationPerson:  header.destinationPerson || undefined,
        destinationZip:     header.destinationZip || undefined,
        destinationAddress: header.destinationAddress || undefined,
        destinationTel:     header.destinationTel || undefined,
        destinationFax:     header.destinationFax || undefined,
        requestNouki:      header.requestNouki || undefined,'''

path = 'src/app/(app)/estimates/new/EstimateNewClient.tsx'
if not os.path.exists(path):
    errors.append(f"❌ ファイル不存在: {path}")
else:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    original = content

    # -- 型定義修正（スペース正規化して検索） --
    # プロジェクトナレッジではスペースが詰まっている場合があるので両方試す
    found_type = False
    for old_t in [OLD_TYPE,
                  OLD_TYPE.replace('  inputDate: string', '  inputDate:        string').replace('  customerOrderNo: string', '  customerOrderNo:  string')]:
        if old_t in content:
            content = content.replace(old_t, NEW_TYPE)
            print("  ✅ [EstimateNewClient] HeaderForm型修正")
            found_type = True
            break
    if not found_type:
        if 'destinationZip' not in content:
            # 現在のHeaderFormを grep で特定してpatch
            import re
            m = re.search(r'type HeaderForm = \{[^}]+\}', content, re.DOTALL)
            if m:
                old_found = m.group(0)
                new_t = old_found.rstrip('}').rstrip() + '\n  destinationZip: string\n  destinationAddress: string\n  destinationTel: string\n  destinationFax: string\n}'
                content = content.replace(old_found, new_t)
                print("  ✅ [EstimateNewClient] HeaderForm型修正（regex）")
            else:
                errors.append("  ❌ [EstimateNewClient] HeaderForm型 見つからず")
        else:
            print("  ⚠ [EstimateNewClient] HeaderForm: destinationZip既存")

    # -- useState初期値修正 --
    if OLD_STATE in content:
        content = content.replace(OLD_STATE, NEW_STATE)
        print("  ✅ [EstimateNewClient] useState初期値 + showDDModal追加")
    elif 'showDDModal' in content:
        print("  ⚠ [EstimateNewClient] showDDModal既存")
    else:
        errors.append("  ❌ [EstimateNewClient] useState初期値置換失敗")

    # -- モーダルJSX挿入 --
    if OLD_MODAL_POS in content and 'DirectDeliveryModal\n          customerCode' not in content:
        content = content.replace(OLD_MODAL_POS, NEW_MODAL_POS)
        print("  ✅ [EstimateNewClient] モーダルJSX挿入")
    elif 'DirectDeliveryModal\n          customerCode' in content:
        print("  ⚠ [EstimateNewClient] モーダルJSX既存")
    else:
        errors.append("  ❌ [EstimateNewClient] モーダルJSX挿入失敗（マーカー見つからず）")

    # -- handleSave payload修正 --
    if OLD_PAYLOAD in content:
        content = content.replace(OLD_PAYLOAD, NEW_PAYLOAD)
        print("  ✅ [EstimateNewClient] handleSave payload zip/address/tel/fax追加")
    elif 'destinationZip:     header.destinationZip' in content:
        print("  ⚠ [EstimateNewClient] payload既に更新済み")
    else:
        errors.append("  ❌ [EstimateNewClient] handleSave payload置換失敗")

    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  💾 [EstimateNewClient] 書き込み完了")
    else:
        print(f"  ⚠ [EstimateNewClient] 変更なし")

# ============================================================
# tsc + git
# ============================================================
print("\n" + "=" * 60)
if errors:
    print(f"⚠ {len(errors)}件の問題あり:")
    for e in errors:
        print(f"  {e}")
    print("\n→ tsc/pushは実行しません")
    sys.exit(1)

print("✅ 全修正完了 → tscチェック開始")
result = subprocess.run(
    ['npx', 'tsc', '--noEmit'],
    capture_output=True, text=True
)
tsc_out = result.stdout + result.stderr
if tsc_out.strip():
    print("tscエラー:\n" + tsc_out[:2000])
    sys.exit(1)

print("✅ tscエラーなし → git add/commit/push")
files = [
    'src/app/api/v1/estimates/calculate/route.ts',
    'src/app/(app)/estimates/new/EstimateNewClient.tsx',
]
subprocess.run(['git', 'add'] + files, check=True)
subprocess.run([
    'git', 'commit', '-m',
    'fix: STEP15残り(HeaderForm+useState+モーダルJSX+payload) + shortestNouki空対応'
], check=True)
subprocess.run(['git', 'push', 'origin', 'main'], check=True)
print("✅ push完了")
