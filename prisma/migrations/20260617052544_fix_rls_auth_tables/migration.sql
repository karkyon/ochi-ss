-- Migration: fix_rls_auth_tables
-- 問題: users/login_histories/security_logs/audit_logs テーブルに
--       RLSが設定されており、認証フロー(auth.ts, pre-check)が
--       app.current_tenant未設定でRLSにブロックされていた
-- 修正: 認証・ログ専用テーブルはRLS不要のため完全無効化

-- users: RLS完全無効化（auth.tsのfindFirst/update/pre-checkが通る必要がある）
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- login_histories: 認証ログ（テナント隔離不要）
ALTER TABLE login_histories DISABLE ROW LEVEL SECURITY;

-- security_logs: セキュリティログ（テナント隔離不要）
ALTER TABLE security_logs DISABLE ROW LEVEL SECURITY;

-- audit_logs: 監査ログ（auth.tsからの書き込みが通る必要がある）
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
