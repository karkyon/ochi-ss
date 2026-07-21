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

/**
 * REDIS_URL を安全にパースする。
 * ★2026/07/21 修正: JavaScript標準の new URL() は、パスワードに
 *   '/' 等のURL予約文字が含まれる(未エンコードの)場合に
 *   "Invalid URL" 例外を投げてしまう。正規表現で
 *   "redis://[:password]@host:port" の形を直接抽出することで、
 *   パスワードのURLエンコードを前提にしない、より頑健な実装にした。
 */
function parseRedisUrl(raw: string): { host: string; port: number; password?: string } {
  const m = raw.match(/^redis:\/\/(?::([^@]*)@)?([^:@/]+):(\d+)/);
  if (!m) {
    throw new Error(`REDIS_URLの形式が不正です: ${raw}`);
  }
  const [, password, host, port] = m;
  return {
    host,
    port: parseInt(port, 10),
    password: password ? password : undefined,
  };
}

const redisConnection = parseRedisUrl(process.env.REDIS_URL!);

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
