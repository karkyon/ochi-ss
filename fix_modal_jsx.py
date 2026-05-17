#!/usr/bin/env python3
"""
モーダルJSX挿入修正スクリプト v3
実行: cd ~/projects/ochi-ss && python3 fix_modal_jsx.py

正確なマーカー: {/* ──────── ヘッダー情報 ──────── */}
（「入力」ではなく「情報」）
"""

import os, sys, subprocess

path = 'src/app/(app)/estimates/new/EstimateNewClient.tsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 既に挿入済みかチェック
if 'DirectDeliveryModal\n          customerCode' in content:
    print("⚠ モーダルJSX既に挿入済み → スキップ")
else:
    # 正確なマーカー（プロジェクトナレッジで確認: ヘッダー「情報」）
    OLD = '      {/* ──────── ヘッダー情報 ──────── */}'
    NEW = '''      {/* 直送先検索モーダル */}
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

      {/* ──────── ヘッダー情報 ──────── */}'''

    if OLD in content:
        content = content.replace(OLD, NEW)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("✅ モーダルJSX挿入完了")
    else:
        # grep でreturn文内の最初のsectionコメントを探す
        import re
        # saveMessageの後のsection開始を探す
        m = re.search(r'(\s+\{/\* ─+\s*ヘッダー(?:情報|入力)\s*─+\s*\*/\})', content)
        if m:
            old_found = m.group(1)
            new_found = '''
      {/* 直送先検索モーダル */}
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
''' + old_found
            content = content.replace(old_found, new_found)
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            print("✅ モーダルJSX挿入完了（regex）")
        else:
            # 最終手段: return ( の直後を探す
            # JSXの return 文の最初の <div の前に挿入
            m2 = re.search(r'(  return \(\n    <div)', content)
            if m2:
                ins = m2.group(1)
                modal_code = '''  return (
    <>
      {/* 直送先検索モーダル */}
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
    <div'''
                content = content.replace('  return (\n    <div', modal_code)
                # 末尾の </div>\n  ) を </div>\n    </>\n  ) に
                content = content.rstrip()
                if content.endswith('  )'):
                    content = content[:-3] + '    </>\n  )'
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print("✅ モーダルJSX挿入完了（return wrap）")
            else:
                print("❌ 挿入位置が見つかりません。現在のreturn文付近を確認:")
                idx = content.find('return (')
                print(content[idx:idx+200])
                sys.exit(1)

# tsc チェック
print("\n→ tscチェック実行中...")
result = subprocess.run(['npx', 'tsc', '--noEmit'], capture_output=True, text=True)
tsc_out = result.stdout + result.stderr
if tsc_out.strip():
    print("tscエラー:\n" + tsc_out[:3000])
    sys.exit(1)

print("✅ tscエラーなし → git push")
subprocess.run(['git', 'add',
    'src/app/api/v1/estimates/calculate/route.ts',
    'src/app/(app)/estimates/new/EstimateNewClient.tsx',
], check=True)
subprocess.run([
    'git', 'commit', '-m',
    'feat: STEP15完了(直送先検索モーダルJSX+HeaderForm+payload) + STEP16(見積番号採番) + JWT140分 + shortestNouki空対応'
], check=True)
subprocess.run(['git', 'push', 'origin', 'main'], check=True)
print("✅ push完了")
