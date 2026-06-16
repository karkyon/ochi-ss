#!/bin/bash
# apply_rls.sh — PostgreSQL RLS ポリシーを適用するスクリプト
# 実行前に: npm run prisma:migrate (AuditLogテーブル作成) を先に実行すること
#
# 実行: cd ~/projects/ochi-ss && bash deploy/apply_rls.sh

set -e
source .env 2>/dev/null || true

# DATABASE_URL から接続情報を取得
DB_URL="${DATABASE_URL}"
echo "=== Ochi-ss RLS Migration 適用 ==="
echo "DB: ${DB_URL%%@*}@..."

# SQLファイルを実行
psql "${DB_URL}" -f "prisma/migrations/20260616000000_rls/migration.sql"

echo "✅ RLS適用完了"
echo ""
echo "確認コマンド:"
echo "  psql \"${DB_URL}\" -c "\\d estimate_headers" | grep -i rls"
