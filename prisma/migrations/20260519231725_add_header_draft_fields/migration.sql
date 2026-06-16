-- AlterTable
ALTER TABLE "estimate_headers" ADD COLUMN     "charge_name" TEXT,
ADD COLUMN     "draft_device_info" TEXT,
ADD COLUMN     "draft_expires_at" TIMESTAMP(3),
ADD COLUMN     "draft_saved_at" TIMESTAMP(3),
ADD COLUMN     "is_draft_only" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "request_nouki" TEXT;

-- CreateIndex
CREATE INDEX "estimate_headers_customer_id_is_draft_only_draft_expires_at_idx" ON "estimate_headers"("customer_id", "is_draft_only", "draft_expires_at");
