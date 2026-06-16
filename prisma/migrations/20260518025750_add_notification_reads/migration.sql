-- CreateTable
CREATE TABLE "notification_reads" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_reads_customer_id_idx" ON "notification_reads"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_reads_notification_id_customer_id_key" ON "notification_reads"("notification_id", "customer_id");
