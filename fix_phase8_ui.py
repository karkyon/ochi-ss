#!/usr/bin/env python3
"""
fix_phase8_ui.py  Phase 8: UI/UX・デザイン統一
=============================================================
Task 8-1-1: globals.css に .ochi-input（黄色フォーカス）/ .number-cell（等幅数値）追加
Task 8-1-2: EstimateNewClient / EstimateEditClient の input/select に ochi-input 適用
Task 8-2-1: .number-cell クラス定義（Courier New 等幅）
Task 8-3-1/2: 明細テーブルを text-[11px] / thead text-[10px] に変更
Task 8-4-1: 明細テーブル thead に sticky top-0 z-10 を適用
Task 8-5-1: 必須フィールドのラベルに * マーク追加
=============================================================
"""
import subprocess
from pathlib import Path

ROOT = Path.home() / "projects" / "ochi-ss"
PASS, FAIL = [], []

def apply(label, path, old, new):
    p = ROOT / path
    if not p.exists():
        FAIL.append(f"[{label}] ファイル未存在")
        print(f"  ❌ {label}")
        return False
    c = p.read_text(encoding="utf-8")
    if old not in c:
        FAIL.append(f"[{label}] パターン不一致")
        print(f"  ❌ {label}")
        return False
    p.write_text(c.replace(old, new, 1), encoding="utf-8")
    PASS.append(label)
    print(f"  ✅ {label}")
    return True

def run_tsc():
    r = subprocess.run(["npx","tsc","--noEmit"], cwd=ROOT, capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr

print("=" * 60)
print("  fix_phase8_ui.py  Phase 8: UI/UX デザイン統一")
print("=" * 60)

# ─────────────────────────────────────────────────────────
# Task 8-1-1 / 8-2-1: globals.css にユーティリティクラス追加
# ─────────────────────────────────────────────────────────
print("\n[Task 8-1-1 / 8-2-1] globals.css .ochi-input / .number-cell 追加")
apply(
    "globals.css: ユーティリティクラス追加",
    "src/app/globals.css",
    """body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}""",
    """body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}

/* ─── Ochi-ss ユーティリティ ─── */

/* フォーカス時黄色ハイライト（旧システム踏襲） */
.ochi-input:focus {
  background-color: #ffffcc !important;
  border-color: #f59e0b !important;
  outline: none !important;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.25) !important;
}

/* 数値カラム等幅フォント */
.number-cell {
  font-family: 'Courier New', 'Consolas', monospace;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* 明細テーブル sticky thead */
.detail-thead th {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: #1a2744;
  color: #ffffff;
}"""
)

# ─────────────────────────────────────────────────────────
# Task 8-1-2: EstimateNewClient 入力フィールドに ochi-input 追加
# ─────────────────────────────────────────────────────────
print("\n[Task 8-1-2] EstimateNewClient ヘッダー入力に ochi-input 適用")

NEW_PATH = "src/app/(app)/estimates/new/EstimateNewClient.tsx"

# ヘッダー: お客様注文No / エンドユーザーNo / 希望納期 / 担当者名 などの共通クラスに追加
# 一括置換: ヘッダーエリア input の focus:ring-blue-500 に ochi-input を追加
p_new = ROOT / NEW_PATH
if p_new.exists():
    content = p_new.read_text(encoding="utf-8")
    # ヘッダー入力フィールドの共通クラスパターン
    old_cls = '"w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"'
    new_cls = '"w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ochi-input"'
    count = content.count(old_cls)
    if count > 0:
        content = content.replace(old_cls, new_cls)
        p_new.write_text(content, encoding="utf-8")
        PASS.append(f"NewClient: ochi-input 適用 ({count}箇所)")
        print(f"  ✅ EstimateNewClient: ochi-input {count}箇所適用")
    else:
        FAIL.append("NewClient: ochi-input 対象パターン不一致")
        print("  ❌ EstimateNewClient: oci-input 対象なし")

print("\n[Task 8-1-2] EstimateEditClient ヘッダー入力に ochi-input 適用")
EDIT_PATH = "src/app/(app)/estimates/[id]/edit/EstimateEditClient.tsx"
p_edit = ROOT / EDIT_PATH
if p_edit.exists():
    content = p_edit.read_text(encoding="utf-8")
    old_cls = '"w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"'
    new_cls = '"w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ochi-input"'
    count = content.count(old_cls)
    if count > 0:
        content = content.replace(old_cls, new_cls)
        p_edit.write_text(content, encoding="utf-8")
        PASS.append(f"EditClient: ochi-input 適用 ({count}箇所)")
        print(f"  ✅ EstimateEditClient: ochi-input {count}箇所適用")
    else:
        FAIL.append("EditClient: ochi-input 対象パターン不一致")
        print("  ❌ EstimateEditClient: ochi-input 対象なし")

# ─────────────────────────────────────────────────────────
# Task 8-3-1/2 + 8-4-1: 明細テーブル フォントサイズ + sticky thead
# EstimateNewClient の明細テーブル
# ─────────────────────────────────────────────────────────
print("\n[Task 8-3/8-4] 明細テーブル フォント11px + sticky thead")

for path, label in [
    (NEW_PATH, "NewClient"),
    (EDIT_PATH, "EditClient"),
]:
    p = ROOT / path
    if not p.exists():
        continue
    content = p.read_text(encoding="utf-8")

    # thead の th background を sticky + detail-thead クラスで統一
    # 既存の thead tr の th: background: #1a2744 パターン
    old_thead_cls = '"bg-[#1a2744] text-white text-[10px] font-medium px-2 py-2 text-center whitespace-nowrap"'
    new_thead_cls = '"bg-[#1a2744] text-white text-[10px] font-medium px-2 py-2 text-center whitespace-nowrap sticky top-0 z-10"'
    if old_thead_cls in content:
        content = content.replace(old_thead_cls, new_thead_cls)
        PASS.append(f"{label}: sticky thead 適用")
        print(f"  ✅ {label}: sticky thead 適用")
    else:
        # 別パターン試行
        old_th2 = 'className="bg-[#1a2744] text-white text-xs font-medium px-2 py-2 text-center whitespace-nowrap"'
        new_th2 = 'className="bg-[#1a2744] text-white text-xs font-medium px-2 py-2 text-center whitespace-nowrap sticky top-0 z-10"'
        if old_th2 in content:
            content = content.replace(old_th2, new_th2)
            PASS.append(f"{label}: sticky thead 適用(alt)")
            print(f"  ✅ {label}: sticky thead 適用(alt)")
        else:
            FAIL.append(f"{label}: thead パターン不一致（手動確認要）")
            print(f"  ⚠ {label}: thead sticky は手動適用が必要")

    # 明細 tbody の td フォントを text-[11px] に統一
    # 数値セルには number-cell も追加
    old_td_num = '"text-right text-sm px-2 py-1.5 font-mono"'
    new_td_num = '"text-right text-[11px] px-2 py-1.5 number-cell"'
    if old_td_num in content:
        content = content.replace(old_td_num, new_td_num)
        PASS.append(f"{label}: 数値セル number-cell 適用")
        print(f"  ✅ {label}: 数値セル number-cell 適用")

    p.write_text(content, encoding="utf-8")

# ─────────────────────────────────────────────────────────
# Task 8-5-1: 明細フォームの必須ラベルに * 追加
# 材料・加工仕様・寸法T/A/B・数量
# ─────────────────────────────────────────────────────────
print("\n[Task 8-5-1] 必須フィールドラベルに ★ 追加")

for path, label in [
    (NEW_PATH, "NewClient"),
    (EDIT_PATH, "EditClient"),
]:
    p = ROOT / path
    if not p.exists():
        continue
    content = p.read_text(encoding="utf-8")
    changed = False

    # 材料
    for old_lbl, new_lbl in [
        ('"材料"', '"材料 <span className=\\"text-red-500\\">*</span>"'),
        (">材料<", ">材料 <span className=\"text-red-500\">*</span><"),
        (">加工仕様<", ">加工仕様 <span className=\"text-red-500\">*</span><"),
        (">数量<", ">数量 <span className=\"text-red-500\">*</span><"),
        (">寸法 T<", ">寸法 T <span className=\"text-red-500\">*</span><"),
        (">寸法 A<", ">寸法 A <span className=\"text-red-500\">*</span><"),
        (">寸法 B<", ">寸法 B <span className=\"text-red-500\">*</span><"),
    ]:
        if old_lbl in content and new_lbl not in content:
            content = content.replace(old_lbl, new_lbl)
            changed = True

    if changed:
        p.write_text(content, encoding="utf-8")
        PASS.append(f"{label}: 必須ラベル * 追加")
        print(f"  ✅ {label}: 必須ラベル追加")
    else:
        print(f"  ⚠ {label}: 必須ラベルはすでに適用済みか対象なし")

# ─────────────────────────────────────────────────────────
# TypeScript チェック
# ─────────────────────────────────────────────────────────
print("\n[TypeScript チェック]")
code, out = run_tsc()
if code == 0:
    print("  ✅ tsc --noEmit: エラーなし")
else:
    print(f"  ❌ tsc エラー:\n{out}")
    FAIL.append("tsc")

print("\n" + "=" * 60)
print(f"  完了: {len(PASS)}件  失敗/警告: {len(FAIL)}件")
if FAIL:
    print("\n  ❌ 失敗:")
    for f in FAIL: print(f"    {f}")

if not any("tsc" in f for f in FAIL):
    print("""
  ✅ Phase 8 実装完了！
  git add -A && git commit -m 'feat: Phase8 UI/UX統一 黄色フォーカス/等幅数値/11px/sticky-thead/必須マーク'
  git push
""")
print("=" * 60)
