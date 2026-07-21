"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const client_1 = require("@prisma/client");
const outbox_worker_1 = require("./workers/outbox.worker");
const polling_worker_1 = require("./workers/polling.worker");
const sqlserver_1 = require("./db/sqlserver");
const prisma = new client_1.PrismaClient();
const redisConnection = {
    host: new URL(process.env.REDIS_URL).hostname,
    port: parseInt(new URL(process.env.REDIS_URL).port || "6379", 10),
    password: new URL(process.env.REDIS_URL).password || undefined,
};
async function main() {
    console.log("[SyncService] starting...");
    // --- PostgreSQL 接続確認 ---
    await prisma.$connect();
    console.log("[SyncService] PostgreSQL connected");
    // --- SQL Server 接続確認 ---
    await (0, sqlserver_1.getSqlServerPool)();
    // --- BullMQ キュー ---
    const outboxQueue = new bullmq_1.Queue("outbox-events", { connection: redisConnection });
    // --- Worker 起動 ---
    const outboxWorker = (0, outbox_worker_1.createOutboxWorker)(redisConnection);
    console.log("[SyncService] OutboxWorker started");
    await (0, outbox_worker_1.startOutboxPoller)(outboxQueue);
    await (0, polling_worker_1.startBizPoller)();
    console.log("[SyncService] all workers running");
    // --- グレースフルシャットダウン ---
    const shutdown = async (signal) => {
        console.log(`[SyncService] ${signal} received, shutting down...`);
        await outboxWorker.close();
        await outboxQueue.close();
        await prisma.$disconnect();
        await (0, sqlserver_1.closeSqlServerPool)();
        process.exit(0);
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}
main().catch((err) => {
    console.error("[SyncService] fatal error:", err);
    process.exit(1);
});
