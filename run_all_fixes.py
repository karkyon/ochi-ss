#!/usr/bin/env python3
"""
run_all_fixes.py
全残課題修正スクリプトを優先順位順に一括実行

実行順序:
  1. fix_bug1_ochi_input.py        ← Bug-1: CSS黄色フォーカス（P0）
  2. fix_bug2_dashboard_banner.py  ← Bug-2: DraftRestoreBanner（P1）
  3. fix_phase2_expired_highlight.py ← Task 2-6-4: 納期切れ赤ハイライト（P0）
  4. fix_phase2_select_all.py      ← Task 2-4-2 + 2-6-5: メッセージ＋全選択（P0）
  5. fix_phase2_material_filter.py ← Task 2-3: 材料×加工仕様フィルタ（P0）
  6. fix_phase5_pdf_log.py         ← Task 5-3: PDF発行ログ（P1）
"""

import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent

SCRIPTS = [
    ("Bug-1: ochi-input CSS黄色フォーカス",         "fix_bug1_ochi_input.py"),
    ("Bug-2: DraftRestoreBanner 表示",              "fix_bug2_dashboard_banner.py"),
    ("Task 2-6-4: 納期切れ赤ハイライト",            "fix_phase2_expired_highlight.py"),
    ("Task 2-4-2 + 2-6-5: メッセージ＋全選択",     "fix_phase2_select_all.py"),
    ("Task 2-3: 材料×加工仕様 動的フィルタ",        "fix_phase2_material_filter.py"),
    ("Task 5-3: PDF発行 SecurityLog 記録",          "fix_phase5_pdf_log.py"),
]

def run_script(label: str, script_name: str) -> bool:
    script_path = SCRIPTS_DIR / script_name
    if not script_path.exists():
        print(f"\n  ❌ スクリプトが見つかりません: {script_path}")
        return False

    print(f"\n{'='*60}")
    print(f"▶ {label}")
    print(f"{'='*60}")

    result = subprocess.run(
        [sys.executable, str(script_path)],
        capture_output=False,
        text=True,
    )
    return result.returncode == 0


if __name__ == "__main__":
    print("🚀 Ochi-ss 残課題修正 一括実行")
    print(f"  スクリプト数: {len(SCRIPTS)} 件")

    results = []
    for label, script in SCRIPTS:
        ok = run_script(label, script)
        results.append((label, ok))

    print("\n" + "="*60)
    print("📋 実行結果サマリー")
    print("="*60)
    for label, ok in results:
        status = "✅" if ok else "❌"
        print(f"  {status} {label}")

    failed = [l for l, ok in results if not ok]
    if failed:
        print(f"\n❌ {len(failed)} 件のスクリプトが失敗しました")
        print("  → 上記ログを確認してください")
        sys.exit(1)
    else:
        print(f"\n✅ 全 {len(SCRIPTS)} 件 完了！")
        print()
        print("【次のステップ】")
        print("  git add -A")
        print('  git commit -m "fix: 残課題 Bug-1/2 + Task 2-3/2-4-2/2-6-4/2-6-5/5-3 一括修正"')
        print("  git push")
        print()
        print("【デプロイ後の動作確認優先順位】")
        print("  1. 入力フォームをクリック → 黄色ハイライト確認（Bug-1）")
        print("  2. ブラウザ DevTools > SessionStorage 'ochi_draft_banner_dismissed' 削除 → バナー確認（Bug-2）")
        print("  3. 材料変更 → 加工仕様が絞り込まれることを確認（Task 2-3）")
        print("  4. deliveryDeadline 過去日付の行が赤くなることを確認（Task 2-6-4）")
        print("  5. thead の全選択チェックボックスで全行選択/解除確認（Task 2-6-5）")
        print("  6. 見積書PDF開封 → DB の security_logs テーブルにレコード追加確認（Task 5-3）")
