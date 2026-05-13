/**
 * sync-service/src/index.ts
 * Sync Service エントリーポイント
 *
 * 起動順:
 *   1. Redis 接続確認
 *   2. PostgreSQL 接続確認（Prisma）
 *   3. SQL Server 接続確認
 *   4. OutboxPoller + OutboxWorker 起動（Web→業務）
 *   5. BizPoller 起動（業務→Web）
 */

import { Queue } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { createOutboxWorker, startOutboxPoller } from "./workers/outbox.worker";
import { startBizPoller } from "./workers/polling.worker";
import { getSqlServerPool, closeSqlServerPool } from "./db/sqlserver";

const prisma = new PrismaClient();

const redisConnection = {
  host: new URL(process.env.REDIS_URL!).hostname,
  port: parseInt(new URL(process.env.REDIS_URL!).port || "6379", 10),
  password: new URL(process.env.REDIS_URL!).password || undefined,
};

async function main() {
  console.log("[SyncService] starting...");

  // --- PostgreSQL 接続確認 ---
  await prisma.$connect();
  console.log("[SyncService] PostgreSQL connected");

  // --- SQL Server 接続確認 ---
  await getSqlServerPool();

  // --- BullMQ キュー ---
  const outboxQueue = new Queue("outbox-events", { connection: redisConnection });

  // --- Worker 起動 ---
  const outboxWorker = createOutboxWorker(redisConnection);
  console.log("[SyncService] OutboxWorker started");

  await startOutboxPoller(outboxQueue);
  await startBizPoller();

  console.log("[SyncService] all workers running");

  // --- グレースフルシャットダウン ---
  const shutdown = async (signal: string) => {
    console.log(`[SyncService] ${signal} received, shutting down...`);
    await outboxWorker.close();
    await outboxQueue.close();
    await prisma.$disconnect();
    await closeSqlServerPool();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[SyncService] fatal error:", err);
  process.exit(1);
});
