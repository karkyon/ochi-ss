#!/usr/bin/env python3
# =============================================================
#  fix_phase3b_ts_errors2.py
#  残りTSエラー修正:
#   EstimateNewClient.tsx(382): toDetailItems が details 宣言前にある
#   → toDetailItems + handleHeaderChange を calcResult 宣言後（details宣言後）に移動
# =============================================================

import os, subprocess, sys

ROOT = os.path.expanduser("~/projects/ochi-ss")

def read(path):
    with open(os.path.join(ROOT, path), "r", encoding="utf-8") as f:
        return f.read()

def write(path, content):
    with open(os.path.join(ROOT, path), "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  ✅ 書き込み完了: {path}")

print("=" * 60)
print("  fix_phase3b_ts_errors2.py  残りTSエラー修正")
print("=" * 60)

NEW_FILE = "src/app/(app)/estimates/new/EstimateNewClient.tsx"
content = read(NEW_FILE)

# ─────────────────────────────────────────────────────────────
# 現状の構造（添付コードより確認済み）:
#
# [Hook初期化]
# const { ... } = useDraftAutoSave(null)
#
# [header useState]
# const [header, setHeader] = useState...
#
# [showDDModal, detailForm]
#
# [toDetailItems] ← ★ここが details 宣言より前（L382付近）
# [handleHeaderChange] ← 同上
#
# [calcResult useState]
#
# [details useState] ← details の宣言はここ
#
# 解決策: toDetailItems + handleHeaderChange のブロック全体を
#        details の useState 宣言の直後に移動する
# ─────────────────────────────────────────────────────────────

# 削除するブロック（detailFormの直後にある toDetailItems+handleHeaderChange）
OLD_BLOCK = """\
  // Draft 用: EstimateDetail（sizeT=string）→ DetailItem（sizeT=number）変換
  const toDetailItems = (dets: typeof details) =>
    dets.map(d => ({
      materialCode:    d.materialCode,
      kakouShiyouCode: d.kakouShiyouCode,
      kakouShijiCodeT: d.kakouShijiCodeT || undefined,
      kakouShijiCodeA: d.kakouShijiCodeA || undefined,
      kakouShijiCodeB: d.kakouShijiCodeB || undefined,
      sizeT:           d.sizeT ? parseFloat(d.sizeT) : 0,
      sizeA:           d.sizeA ? parseFloat(d.sizeA) : 0,
      sizeB:           d.sizeB ? parseFloat(d.sizeB) : 0,
      kousaTUpper:     d.kousaTUpper ? parseFloat(d.kousaTUpper) : null,
      kousaTLower:     d.kousaTLower ? parseFloat(d.kousaTLower) : null,
      kousaAUpper:     d.kousaAUpper ? parseFloat(d.kousaAUpper) : null,
      kousaALower:     d.kousaALower ? parseFloat(d.kousaALower) : null,
      kousaBUpper:     d.kousaBUpper ? parseFloat(d.kousaBUpper) : null,
      kousaBLower:     d.kousaBLower ? parseFloat(d.kousaBLower) : null,
      mentori4:        d.mentori4 ? parseFloat(d.mentori4) : null,
      mentori8:        d.mentori8 ? parseFloat(d.mentori8) : null,
      quantity:        d.quantity ? parseInt(d.quantity) : 0,
      unitPrice:       d.unitPrice,
      totalPrice:      d.totalPrice,
      shortestDelivery: d.shortestDelivery ?? null,
      deliveryDeadline: d.deliveryDeadline ?? null,
    }))

  // ヘッダー変更時に自動保存トリガー
  const handleHeaderChange = useCallback((updater: (h: HeaderForm) => HeaderForm) => {
    setHeader(prev => {
      const next = updater(prev)
      triggerSave(next, toDetailItems(details))
      return next
    })
  }, [details, triggerSave]) // eslint-disable-line react-hooks/exhaustive-deps

  // 計算結果（計算ボタン押下後）"""

NEW_BLOCK = """\
  // 計算結果（計算ボタン押下後）"""

if OLD_BLOCK not in content:
    # パターンが見つからない場合、コンテキストを表示
    idx = content.find("toDetailItems")
    print(f"  ⚠️  OLD_BLOCK未発見。toDetailItems 周辺コンテキスト:")
    print(repr(content[max(0,idx-100):idx+200]))
    sys.exit(1)

# ① toDetailItems+handleHeaderChange を calcResult 宣言前から除去
content = content.replace(OLD_BLOCK, NEW_BLOCK, 1)
print("  ✅ [toDetailItems+handleHeaderChange を削除（calcResult前から）]")

# ② details useState の直後に挿入
# 添付コードより details の useState の末尾は "intermediate: null,\n    }))\n  })" で終わる
INSERT_AFTER = """\
      intermediate:     null,
    }))
  })

  // UI状態"""

INSERT_NEW = """\
      intermediate:     null,
    }))
  })

  // Draft 用: EstimateDetail（sizeT=string）→ DetailItem（sizeT=number）変換
  const toDetailItems = (dets: EstimateDetail[]) =>
    dets.map(d => ({
      materialCode:    d.materialCode,
      kakouShiyouCode: d.kakouShiyouCode,
      kakouShijiCodeT: d.kakouShijiCodeT || undefined,
      kakouShijiCodeA: d.kakouShijiCodeA || undefined,
      kakouShijiCodeB: d.kakouShijiCodeB || undefined,
      sizeT:           d.sizeT ? parseFloat(d.sizeT) : 0,
      sizeA:           d.sizeA ? parseFloat(d.sizeA) : 0,
      sizeB:           d.sizeB ? parseFloat(d.sizeB) : 0,
      kousaTUpper:     d.kousaTUpper ? parseFloat(d.kousaTUpper) : null,
      kousaTLower:     d.kousaTLower ? parseFloat(d.kousaTLower) : null,
      kousaAUpper:     d.kousaAUpper ? parseFloat(d.kousaAUpper) : null,
      kousaALower:     d.kousaALower ? parseFloat(d.kousaALower) : null,
      kousaBUpper:     d.kousaBUpper ? parseFloat(d.kousaBUpper) : null,
      kousaBLower:     d.kousaBLower ? parseFloat(d.kousaBLower) : null,
      mentori4:        d.mentori4 ? parseFloat(d.mentori4) : null,
      mentori8:        d.mentori8 ? parseFloat(d.mentori8) : null,
      quantity:        d.quantity ? parseInt(d.quantity) : 0,
      unitPrice:       d.unitPrice,
      totalPrice:      d.totalPrice,
      shortestDelivery: d.shortestDelivery ?? null,
      deliveryDeadline: d.deliveryDeadline ?? null,
    }))

  // ヘッダー変更時に自動保存トリガー
  const handleHeaderChange = useCallback((updater: (h: HeaderForm) => HeaderForm) => {
    setHeader(prev => {
      const next = updater(prev)
      triggerSave(next, toDetailItems(details))
      return next
    })
  }, [details, triggerSave]) // eslint-disable-line react-hooks/exhaustive-deps

  // UI状態"""

if INSERT_AFTER not in content:
    # コピー元なしの場合 details 初期化の末尾を別パターンで探す
    idx2 = content.find("  // UI状態")
    print(f"  ⚠️  INSERT_AFTER未発見。'// UI状態' 周辺:")
    print(repr(content[max(0,idx2-200):idx2+50]))
    sys.exit(1)

content = content.replace(INSERT_AFTER, INSERT_NEW, 1)
print("  ✅ [toDetailItems+handleHeaderChange を details 宣言後に挿入]")

# ③ 明細追加 handleAddDetail の setDetails パターン修正
# 添付コードより実際のパターン確認済み
ADD_OLD = "    setDetails(prev => [...prev, newDetail])\n    setDetailForm(EMPTY_DETAIL_FORM)"
ADD_NEW = """\
    setDetails(prev => {
      const next = [...prev, newDetail]
      triggerSave(header, toDetailItems(next), true) // 明細追加時は即時保存
      return next
    })
    setDetailForm(EMPTY_DETAIL_FORM)"""

if ADD_OLD in content:
    content = content.replace(ADD_OLD, ADD_NEW, 1)
    print("  ✅ [明細追加時 triggerSave 即時保存 適用]")
else:
    # 別パターンを探す
    idx3 = content.find("setDetails(prev => [")
    if idx3 > 0:
        print(f"  ℹ️  ADD_OLD未発見。setDetails 周辺:")
        print(repr(content[idx3:idx3+150]))
    else:
        print("  ℹ️  setDetails パターン未発見（スキップ）")

write(NEW_FILE, content)

# ─────────────────────────────────────────────────────────────
# tsc --noEmit
# ─────────────────────────────────────────────────────────────
print("\n[TypeScript チェック]")
result = subprocess.run(
    ["npx", "tsc", "--noEmit"],
    cwd=ROOT,
    capture_output=True,
    text=True,
)
if result.returncode == 0:
    print("  ✅ tsc --noEmit: エラーなし")
else:
    print("  ❌ tsc エラー:")
    out = result.stdout + result.stderr
    print(out[-5000:] if len(out) > 5000 else out)
    sys.exit(1)

print("\n" + "=" * 60)
print("  Phase 3-B TSエラー完全修正！")
print("  次のコマンドを実行:")
print("  git add -A && git commit -m 'fix: Phase3-B TSエラー完全修正 toDetailItems移動'")
print("  git push")
print("=" * 60)
