-- AlterTable
ALTER TABLE "estimate_headers" ADD COLUMN     "direct_delivery_id" TEXT;

-- AlterTable
ALTER TABLE "estimate_details" ADD COLUMN     "indiv_direct_delivery_id" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "business_order_no" TEXT,
ADD COLUMN     "business_sales_no" TEXT,
ADD COLUMN     "business_imported_at" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "estimate_headers" ADD CONSTRAINT "estimate_header_direct_delivery_fk" FOREIGN KEY ("direct_delivery_id") REFERENCES "direct_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_details" ADD CONSTRAINT "estimate_detail_indiv_direct_delivery_fk" FOREIGN KEY ("indiv_direct_delivery_id") REFERENCES "direct_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
