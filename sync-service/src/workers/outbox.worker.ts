/**
 * outbox.worker.ts
 * Web → 業務（SQL Server）方向の Transactional Outbox Worker
 *
 * - BullMQ + Redis でジョブキュー管理
 * - outbox_events を 5秒間隔でポーリング
 * - SQL Server の WEBデータ確認 に UPSERT
 * - 失敗時: retry_count++, MAX_RETRIES 超過で dead_letter
 */

import { Worker, Queue, Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import sql from "mssql";
import { getSqlServerPool } from "../db/sqlserver";

const prisma = new PrismaClient();
const OUTBOX_QUEUE = "outbox-events";
const MAX_RETRIES = 5;
const POLL_INTERVAL_MS = parseInt(process.env.OUTBOX_POLL_INTERVAL_MS ?? "5000", 10);

// ---------------------------------------------------------------------------
//  ポーリング: outbox_events から pending イベントをジョブに変換
// ---------------------------------------------------------------------------
export async function startOutboxPoller(queue: Queue): Promise<void> {
  const poll = async () => {
    try {
      const pendingEvents = await prisma.outboxEvent.findMany({
        where: {
          status: "pending",
          retryCount: { lt: MAX_RETRIES },
        },
        orderBy: { createdAt: "asc" },
        take: 50,
      });

      for (const event of pendingEvents) {
        // processing 状態にしてから enqueue（二重処理防止）
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: "processing", lastAttemptAt: new Date() },
        });

        await queue.add(
          "send-to-biz",
          { eventId: event.id },
          {
            jobId: event.id,          // べき等: 同じIDは上書き
            removeOnComplete: true,
            removeOnFail: false,
          }
        );
      }
    } catch (err) {
      console.error("[OutboxPoller] polling error:", err);
    }
  };

  // 初回即時実行、以後インターバル
  await poll();
  setInterval(poll, POLL_INTERVAL_MS);
  console.log(`[OutboxPoller] started (interval: ${POLL_INTERVAL_MS}ms)`);
}

// ---------------------------------------------------------------------------
//  Worker: ジョブを処理して SQL Server へ UPSERT
// ---------------------------------------------------------------------------
export function createOutboxWorker(redisConnection: { host: string; port: number; password?: string }) {
  return new Worker(
    OUTBOX_QUEUE,
    async (job: Job<{ eventId: string }>) => {
      const { eventId } = job.data;
      const event = await prisma.outboxEvent.findUnique({ where: { id: eventId } });

      if (!event) {
        console.warn(`[OutboxWorker] event not found: ${eventId}`);
        return;
      }

      const pool = await getSqlServerPool();
      const started = Date.now();

      try {
        await processOutboxEvent(event, pool);

        // 成功
        await prisma.outboxEvent.update({
          where: { id: eventId },
          data: { status: "sent", sentAt: new Date() },
        });

        await writeSyncLog({
          direction: "web_to_biz",
          eventType: event.eventType,
          sourceTable: event.aggregateType === "order" ? "orders" : "estimate_headers",
          targetTable: "WEBデータ確認",
          recordId: event.aggregateId,
          payload: event.payload,
          status: "success",
          durationMs: Date.now() - started,
        });

        console.log(`[OutboxWorker] sent: ${eventId} (${event.eventType})`);
      } catch (err: any) {
        const retryCount = event.retryCount + 1;
        const isDead = retryCount >= MAX_RETRIES;

        await prisma.outboxEvent.update({
          where: { id: eventId },
          data: {
            status: isDead ? "dead_letter" : "pending",
            retryCount,
            errorMessage: err.message ?? String(err),
          },
        });

        await writeSyncLog({
          direction: "web_to_biz",
          eventType: event.eventType,
          sourceTable: event.aggregateType === "order" ? "orders" : "estimate_headers",
          targetTable: "WEBデータ確認",
          recordId: event.aggregateId,
          payload: event.payload,
          status: "failed",
          errorMessage: err.message,
          durationMs: Date.now() - started,
        });

        if (isDead) {
          console.error(`[OutboxWorker] DEAD LETTER: ${eventId}`, err);
        } else {
          throw err; // BullMQ にリトライさせる
        }
      }
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );
}

// ---------------------------------------------------------------------------
//  SQL Server への UPSERT 処理
// ---------------------------------------------------------------------------
async function processOutboxEvent(event: any, pool: sql.ConnectionPool): Promise<void> {
  const payload = event.payload as Record<string, any>;

  if (event.eventType === "order.placed" || event.eventType === "estimate.created") {
    // WEBデータ確認 へ UPSERT
    await pool.request()
      .input("WEB注文番号",    sql.NVarChar(50),  payload.orderNo ?? event.aggregateId)
      .input("得意先コード",   sql.NVarChar(10),  payload.customerCode)
      .input("見積番号",       sql.NVarChar(8),   payload.estimateNo ?? null)
      .input("注文日付",       sql.DateTime,      new Date(payload.orderDate))
      .input("送り先名",       sql.NVarChar(100), payload.destinationName ?? null)
      .input("合計金額",       sql.Money,         payload.totalAmount ?? 0)
      .input("明細件数",       sql.Int,           payload.detailCount ?? 0)
      .input("最終更新日時",   sql.DateTime,      new Date())
      .query(`
        MERGE WEBデータ確認 AS target
        USING (SELECT @WEB注文番号 AS WEB注文番号) AS source
          ON target.WEB注文番号 = source.WEB注文番号
        WHEN MATCHED THEN
          UPDATE SET
            得意先コード   = @得意先コード,
            見積番号       = @見積番号,
            注文日付       = @注文日付,
            送り先名       = @送り先名,
            合計金額       = @合計金額,
            明細件数       = @明細件数,
            最終更新日時   = @最終更新日時
        WHEN NOT MATCHED THEN
          INSERT (WEB注文番号, 得意先コード, 見積番号, 注文日付,
                  送り先名, 合計金額, 明細件数, 最終更新日時)
          VALUES (@WEB注文番号, @得意先コード, @見積番号, @注文日付,
                  @送り先名, @合計金額, @明細件数, @最終更新日時);
      `);
  }

  // 他の eventType は今後追加
}

// ---------------------------------------------------------------------------
//  同期ログ書き込みヘルパー
// ---------------------------------------------------------------------------
async function writeSyncLog(params: {
  direction: string;
  eventType: string;
  sourceTable: string;
  targetTable: string;
  recordId: string;
  payload?: any;
  status: string;
  errorMessage?: string;
  durationMs?: number;
}) {
  try {
    await prisma.syncChangeLog.create({ data: params });
  } catch (e) {
    console.error("[OutboxWorker] failed to write sync log:", e);
  }
}
