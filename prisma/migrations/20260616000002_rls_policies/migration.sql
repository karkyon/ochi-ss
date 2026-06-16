-- Migration: 20260616000002_rls_policies
ALTER TABLE estimate_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_headers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON estimate_headers;
CREATE POLICY tenant_isolation ON estimate_headers
  USING (customer_id::text = current_setting('app.current_tenant', true)
         OR current_setting('app.is_super_admin', true) = 'true')
  WITH CHECK (customer_id::text = current_setting('app.current_tenant', true));

ALTER TABLE estimate_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_details FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON estimate_details;
CREATE POLICY tenant_isolation ON estimate_details
  USING (estimate_header_id IN (
           SELECT id FROM estimate_headers
           WHERE customer_id::text = current_setting('app.current_tenant', true))
         OR current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON orders;
CREATE POLICY tenant_isolation ON orders
  USING (customer_id::text = current_setting('app.current_tenant', true)
         OR current_setting('app.is_super_admin', true) = 'true')
  WITH CHECK (customer_id::text = current_setting('app.current_tenant', true));

ALTER TABLE direct_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_deliveries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON direct_deliveries;
CREATE POLICY tenant_isolation ON direct_deliveries
  USING (customer_id::text = current_setting('app.current_tenant', true)
         OR current_setting('app.is_super_admin', true) = 'true')
  WITH CHECK (customer_id::text = current_setting('app.current_tenant', true));

ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_reads FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON notification_reads;
CREATE POLICY tenant_isolation ON notification_reads
  USING (customer_id::text = current_setting('app.current_tenant', true)
         OR current_setting('app.is_super_admin', true) = 'true')
  WITH CHECK (customer_id::text = current_setting('app.current_tenant', true));

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON users;
CREATE POLICY tenant_isolation ON users
  USING (customer_id::text = current_setting('app.current_tenant', true)
         OR current_setting('app.is_super_admin', true) = 'true');

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON audit_logs;
CREATE POLICY tenant_isolation ON audit_logs
  USING (customer_id::text = current_setting('app.current_tenant', true)
         OR current_setting('app.is_super_admin', true) = 'true')
  WITH CHECK (customer_id::text = current_setting('app.current_tenant', true));

CREATE INDEX IF NOT EXISTS idx_estimate_headers_tenant_status
  ON estimate_headers(customer_id, estimate_status) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_estimate_headers_tenant_date
  ON estimate_headers(customer_id, estimate_date DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status
  ON orders(customer_id, order_status) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_direct_deliveries_tenant
  ON direct_deliveries(customer_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_notification_reads_tenant
  ON notification_reads(customer_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant
  ON users(customer_id) WHERE is_deleted = false;
