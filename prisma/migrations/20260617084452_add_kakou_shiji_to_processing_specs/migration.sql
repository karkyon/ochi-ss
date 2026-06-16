-- add kakou_shiji columns to processing_specs
-- WO加工仕様テーブルの加工指示コード(T/A/B)をキャッシュ
ALTER TABLE processing_specs
  ADD COLUMN IF NOT EXISTS kakou_shiji_t VARCHAR(10) DEFAULT 'W',
  ADD COLUMN IF NOT EXISTS kakou_shiji_a VARCHAR(10) DEFAULT 'W',
  ADD COLUMN IF NOT EXISTS kakou_shiji_b VARCHAR(10) DEFAULT 'W';
