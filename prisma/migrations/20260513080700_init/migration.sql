-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "customer_code" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_status" INTEGER NOT NULL DEFAULT 1,
    "login_enabled" BOOLEAN NOT NULL DEFAULT true,
    "feature_restrictions" JSONB,
    "allowed_pages" JSONB,
    "session_timeout_min" INTEGER NOT NULL DEFAULT 140,
    "max_concurrent_logins" INTEGER NOT NULL DEFAULT 5,
    "high_security_flag" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "charge_name" TEXT,
    "user_status" INTEGER NOT NULL DEFAULT 1,
    "account_locked" BOOLEAN NOT NULL DEFAULT false,
    "user_role" INTEGER NOT NULL DEFAULT 1,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_histories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "customer_code" TEXT NOT NULL,
    "login_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT,
    "session_id" TEXT,
    "result" INTEGER NOT NULL,
    "fail_reason" TEXT,
    "login_method" TEXT,

    CONSTRAINT "login_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_logs" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "ip_address" TEXT,
    "username" TEXT,
    "log_level" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_headers" (
    "id" TEXT NOT NULL,
    "estimate_no" TEXT,
    "customer_id" TEXT NOT NULL,
    "customer_code" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_order_no" TEXT,
    "end_user_no" TEXT,
    "estimate_date" TIMESTAMP(3),
    "input_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "destination_code" TEXT,
    "destination_name" TEXT,
    "destination_dept" TEXT,
    "destination_person" TEXT,
    "destination_zip" TEXT,
    "destination_address" TEXT,
    "destination_tel" TEXT,
    "destination_fax" TEXT,
    "shipping_method_id" INTEGER,
    "remarks" TEXT,
    "estimate_status" TEXT NOT NULL DEFAULT 'draft',
    "edit_mode" TEXT NOT NULL DEFAULT 'new',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "estimate_headers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_details" (
    "id" TEXT NOT NULL,
    "estimate_header_id" TEXT NOT NULL,
    "row_no" INTEGER NOT NULL,
    "material_code" TEXT NOT NULL,
    "material_name" TEXT,
    "kakou_shiyou_code" INTEGER NOT NULL,
    "kakou_shiyou" TEXT,
    "kakou_shiji_code_t" TEXT,
    "kakou_shiji_code_a" TEXT,
    "kakou_shiji_code_b" TEXT,
    "kakou_t" TEXT,
    "kakou_a" TEXT,
    "kakou_b" TEXT,
    "size_t" DECIMAL(7,3) NOT NULL,
    "size_a" DECIMAL(7,3) NOT NULL,
    "size_b" DECIMAL(7,3) NOT NULL,
    "kousa_t_upper" DECIMAL(6,3),
    "kousa_t_lower" DECIMAL(6,3),
    "kousa_a_upper" DECIMAL(6,3),
    "kousa_a_lower" DECIMAL(6,3),
    "kousa_b_upper" DECIMAL(6,3),
    "kousa_b_lower" DECIMAL(6,3),
    "mentori_shiji" TEXT,
    "mentori_4" DECIMAL(5,2),
    "mentori_8" DECIMAL(5,2),
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2),
    "total_price" DECIMAL(14,2),
    "shortest_delivery" TEXT,
    "delivery_deadline" TIMESTAMP(3),
    "material_size_t" DECIMAL(7,3),
    "material_size_a" DECIMAL(7,3),
    "material_size_b" DECIMAL(7,3),
    "material_unit_weight" DECIMAL(10,4),
    "material_total_weight" DECIMAL(10,4),
    "product_unit_weight" DECIMAL(10,4),
    "product_total_weight" DECIMAL(10,4),
    "processing_cost_6f" DECIMAL(12,2),
    "processing_cost_total" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "estimate_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "order_no" TEXT,
    "estimate_header_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "order_status" TEXT NOT NULL DEFAULT 'pending',
    "total_amount" DECIMAL(14,2),
    "detail_count" INTEGER,
    "tracking_no" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_deliveries" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "customer_code" TEXT NOT NULL,
    "delivery_code" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "furigana" TEXT,
    "short_name" TEXT,
    "corporate_type" TEXT,
    "corporate_position" TEXT,
    "department_name" TEXT,
    "contact_person" TEXT,
    "postal_code" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "address3" TEXT,
    "phone_number" TEXT,
    "fax_number" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "direct_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "material_code" TEXT NOT NULL,
    "material_name" TEXT NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_specs" (
    "id" TEXT NOT NULL,
    "processing_spec_code" INTEGER NOT NULL,
    "processing_spec_name" TEXT NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "notif_type" TEXT NOT NULL,
    "target_customers" JSONB,
    "published_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_histories" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "change_source" TEXT NOT NULL,
    "change_reason" TEXT,
    "tracking_no" TEXT,
    "notified_at" TIMESTAMP(3),
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spec_change_histories" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "row_no" INTEGER NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT NOT NULL,
    "change_reason" TEXT,
    "changed_by" TEXT NOT NULL,
    "change_source" TEXT NOT NULL,
    "web_notified_at" TIMESTAMP(3),
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spec_change_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_change_logs" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "source_table" TEXT NOT NULL,
    "target_table" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_ms" INTEGER,

    CONSTRAINT "sync_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_customer_code_key" ON "customers"("customer_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_customer_id_username_key" ON "users"("customer_id", "username");

-- CreateIndex
CREATE INDEX "login_histories_user_id_login_at_idx" ON "login_histories"("user_id", "login_at");

-- CreateIndex
CREATE INDEX "security_logs_occurred_at_idx" ON "security_logs"("occurred_at");

-- CreateIndex
CREATE INDEX "security_logs_log_level_occurred_at_idx" ON "security_logs"("log_level", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "estimate_headers_estimate_no_key" ON "estimate_headers"("estimate_no");

-- CreateIndex
CREATE INDEX "estimate_headers_customer_id_estimate_status_idx" ON "estimate_headers"("customer_id", "estimate_status");

-- CreateIndex
CREATE INDEX "estimate_headers_estimate_no_idx" ON "estimate_headers"("estimate_no");

-- CreateIndex
CREATE INDEX "estimate_details_estimate_header_id_idx" ON "estimate_details"("estimate_header_id");

-- CreateIndex
CREATE UNIQUE INDEX "estimate_details_estimate_header_id_row_no_key" ON "estimate_details"("estimate_header_id", "row_no");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_no_key" ON "orders"("order_no");

-- CreateIndex
CREATE UNIQUE INDEX "orders_estimate_header_id_key" ON "orders"("estimate_header_id");

-- CreateIndex
CREATE INDEX "orders_customer_id_order_status_idx" ON "orders"("customer_id", "order_status");

-- CreateIndex
CREATE UNIQUE INDEX "direct_deliveries_customer_code_delivery_code_key" ON "direct_deliveries"("customer_code", "delivery_code");

-- CreateIndex
CREATE UNIQUE INDEX "materials_material_code_key" ON "materials"("material_code");

-- CreateIndex
CREATE UNIQUE INDEX "processing_specs_processing_spec_code_key" ON "processing_specs"("processing_spec_code");

-- CreateIndex
CREATE INDEX "notifications_published_at_expires_at_idx" ON "notifications"("published_at", "expires_at");

-- CreateIndex
CREATE INDEX "outbox_events_status_created_at_idx" ON "outbox_events"("status", "created_at");

-- CreateIndex
CREATE INDEX "order_status_histories_order_id_occurred_at_idx" ON "order_status_histories"("order_id", "occurred_at");

-- CreateIndex
CREATE INDEX "spec_change_histories_order_id_occurred_at_idx" ON "spec_change_histories"("order_id", "occurred_at");

-- CreateIndex
CREATE INDEX "sync_change_logs_direction_processed_at_idx" ON "sync_change_logs"("direction", "processed_at");

-- CreateIndex
CREATE INDEX "sync_change_logs_record_id_idx" ON "sync_change_logs"("record_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_histories" ADD CONSTRAINT "login_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_headers" ADD CONSTRAINT "estimate_headers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_details" ADD CONSTRAINT "estimate_details_estimate_header_id_fkey" FOREIGN KEY ("estimate_header_id") REFERENCES "estimate_headers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_estimate_header_id_fkey" FOREIGN KEY ("estimate_header_id") REFERENCES "estimate_headers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_deliveries" ADD CONSTRAINT "direct_deliveries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_estimate_fk" FOREIGN KEY ("aggregate_id") REFERENCES "estimate_headers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_order_fk" FOREIGN KEY ("aggregate_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_histories" ADD CONSTRAINT "order_status_histories_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_change_histories" ADD CONSTRAINT "spec_change_histories_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
