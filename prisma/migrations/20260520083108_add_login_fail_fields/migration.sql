-- AlterTable
ALTER TABLE "users" ADD COLUMN     "locked_until" TIMESTAMP(3),
ADD COLUMN     "login_fail_count" INTEGER NOT NULL DEFAULT 0;
