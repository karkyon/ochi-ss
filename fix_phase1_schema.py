#!/usr/bin/env python3
"""
fix_phase1_schema.py
Task 1-2: EstimateHeader に requestNouki / chargeName 追加
Task 1-3: EstimateHeader に Draft 管理フィールド 4件追加

対象: prisma/schema.prisma
"""

import sys
import os
import re

# ── パス設定 ──
SCHEMA_PATH = "prisma/schema.prisma"

# ── ヘルパー ──
def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()

def write(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  ✅ 書き込み完了: {path}")

def patch(content, old, new, label):
    if old not in content:
        print(f"  ⚠️  [{label}] 対象文字列が見つかりません（既に適用済みか確認してください）")
        return content, False
    result = content.replace(old, new, 1)
    print(f"  ✅ [{label}] パッチ適用")
    return result, True

# ════════════════════════════════════════════════════
# schema.prisma 修正
# ════════════════════════════════════════════════════

def fix_schema():
    print(f"\n{'='*60}")
    print("Phase 1: prisma/schema.prisma 修正")
    print('='*60)

    if not os.path.exists(SCHEMA_PATH):
        print(f"  ❌ ファイルが見つかりません: {SCHEMA_PATH}")
        sys.exit(1)

    content = read(SCHEMA_PATH)
    changed = False

    # ────────────────────────────────────────────────
    # Task 1-2: EstimateHeader に requestNouki / chargeName 追加
    # remarks フィールドの直前に挿入
    # ────────────────────────────────────────────────
    
    # requestNouki が未存在の場合のみ追加
    if "requestNouki" not in content:
        old = "  remarks            String?"
        new = (
            "  requestNouki       String?   @map(\"request_nouki\")        // 希望納期（テキスト入力）\n"
            "  chargeName         String?   @map(\"charge_name\")          // 担当者名\n"
            "  remarks            String?"
        )
        content, ok = patch(content, old, new, "Task 1-2: requestNouki / chargeName 追加")
        if ok:
            changed = True
    else:
        print("  ℹ️  [Task 1-2] requestNouki は既存（スキップ）")

    if "chargeName" not in content:
        print("  ⚠️  [Task 1-2] chargeName が未追加です。手動確認してください")

    # ────────────────────────────────────────────────
    # Task 1-3: Draft 管理フィールド 4件追加
    # isDeleted の直前に挿入
    # ────────────────────────────────────────────────
    if "isDraftOnly" not in content:
        old = (
            "  isDeleted          Boolean   @default(false) @map(\"is_deleted\")\n"
            "\n"
            "  customer    Customer         @relation"
        )
        new = (
            "  isDraftOnly        Boolean   @default(false) @map(\"is_draft_only\")  // Draft専用フラグ\n"
            "  draftExpiresAt     DateTime? @map(\"draft_expires_at\")               // Draft有効期限\n"
            "  draftSavedAt       DateTime? @map(\"draft_saved_at\")                 // 最終自動保存日時\n"
            "  draftDeviceInfo    String?   @map(\"draft_device_info\")              // 保存端末情報\n"
            "  isDeleted          Boolean   @default(false) @map(\"is_deleted\")\n"
            "\n"
            "  customer    Customer         @relation"
        )
        content, ok = patch(content, old, new, "Task 1-3: Draft管理フィールド追加")
        if ok:
            changed = True
    else:
        print("  ℹ️  [Task 1-3] isDraftOnly は既存（スキップ）")

    # ── インデックス追加 (isDraftOnly での検索最適化) ──
    if "isDraftOnly" in content and "isDraftOnly, draftExpiresAt" not in content:
        old = "  @@index([customerId, estimateStatus])"
        new = (
            "  @@index([customerId, estimateStatus])\n"
            "  @@index([customerId, isDraftOnly, draftExpiresAt])"
        )
        content, ok = patch(content, old, new, "Task 1-3: Draft用インデックス追加")
        if ok:
            changed = True

    if changed:
        write(SCHEMA_PATH, content)
        print("\n  ✅ schema.prisma 修正完了")
    else:
        print("\n  ℹ️  schema.prisma は変更なし（全て既存）")

    return changed


# ════════════════════════════════════════════════════
# メイン
# ════════════════════════════════════════════════════
if __name__ == "__main__":
    print("╔══════════════════════════════════════════╗")
    print("║  fix_phase1_schema.py                   ║")
    print("║  Phase 1: DB スキーマ拡張               ║")
    print("╚══════════════════════════════════════════╝")

    fix_schema()

    print("\n" + "="*60)
    print("完了。次のコマンドを手動実行してください:")
    print("")
    print("  npx prisma format")
    print("  npx prisma validate")
    print("  npx prisma migrate dev --name add_header_draft_fields")
    print("")
    print("migrate 成功後に fix_phase2_estimate_ui.py を実行してください。")
    print("="*60)
