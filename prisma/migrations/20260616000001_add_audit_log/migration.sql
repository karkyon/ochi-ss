-- Migration: 20260616000001_add_audit_log
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id"          TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "user_id"     TEXT NOT NULL,
    "action"      TEXT NOT NULL,
    "resource"    TEXT NOT NULL,
    "resource_id" TEXT,
    "ip_address"  TEXT,
    "user_agent"  TEXT,
    "result_code" INTEGER NOT NULL DEFAULT 200,
    "detail"      JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_audit_logs_tenant_date" ON "audit_logs"("customer_id","occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_audit_logs_user_date"   ON "audit_logs"("user_id","occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_audit_logs_resource"    ON "audit_logs"("resource","resource_id");
