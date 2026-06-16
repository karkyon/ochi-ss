-- Migration: fix_rls_auth
-- 問題: FORCE ROW LEVEL SECURITY により auth.ts のログイン認証クエリが
--       app.current_tenant 未設定でブロックされていた
-- 修正: users テーブルの FORCE を解除
--       （DBオーナーロールはデフォルトでRLSをバイパスするため認証は通る）
--       RLS自体は有効のままなのでwithTenant経由のAPIは引き続きテナント隔離される

ALTER TABLE users NO FORCE ROW LEVEL SECURITY;

-- customers テーブルはそもそもRLS未設定だが念のため確認
-- (auth.ts で customer.findFirst を呼ぶため RLS を有効化しない)
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY; ← 意図的に設定しない
