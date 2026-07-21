/**
 * outbox.worker.ts
 * Web → 業務（SQL Server）方向の Transactional Outbox Worker
 *
 * - BullMQ + Redis でジョブキュー管理
 * - outbox_events を 5秒間隔でポーリング
 * - SQL Server の WEBデータ確認 / WEBデータ確認明細 に UPSERT
 * - 失敗時: retry_count++, MAX_RETRIES 超過で dead_letter
 *
 * ★2026/07/16 全面書き換え:
 *   旧実装は WEBデータ確認(ヘッダーのみ・明細行なし)に浅い内容を
 *   書き込むだけで、直送先単位の取込に必要な明細情報が一切
 *   同期されていなかった。outbox payload に頼らず、常に
 *   Prisma から最新のヘッダー・明細・得意先情報を取得し直してから
 *   MERGEする方式に変更した(payloadは「何が起きたか」のトリガーのみ)。
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
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: "processing", lastAttemptAt: new Date() },
        });

        await queue.add(
          "send-to-biz",
          { eventId: event.id },
          {
            jobId: event.id,
            removeOnComplete: true,
            removeOnFail: false,
          }
        );
      }
    } catch (err) {
      console.error("[OutboxPoller] polling error:", err);
    }
  };

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
          throw err;
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
  if (event.aggregateType === "estimate" &&
      (event.eventType === "estimate.created" || event.eventType === "estimate.updated")) {
    await syncEstimateToConfirmTables(event.aggregateId, pool);
    return;
  }

  if (event.aggregateType === "order" && event.eventType === "order.placed") {
    // 注文確定によって明細のorderId等が変わるため、見積側を再同期する
    const order = await prisma.order.findUnique({ where: { id: event.aggregateId } });
    if (order) {
      await syncEstimateToConfirmTables(order.estimateHeaderId, pool);
    }
    return;
  }

  // 他の eventType は今後追加
}

async function syncEstimateToConfirmTables(estimateHeaderId: string, pool: sql.ConnectionPool): Promise<void> {
  const header = await prisma.estimateHeader.findUnique({
    where: { id: estimateHeaderId },
    include: { details: { where: { isDeleted: false } }, customer: true },
  });

  if (!header) {
    console.warn(`[OutboxWorker] estimate header not found: ${estimateHeaderId}`);
    return;
  }

  // --- ヘッダー MERGE ---
  await pool.request()
    .input("WEB見積ID",       sql.NVarChar(36),  header.id)
    .input("WEB見積番号",     sql.NVarChar(20),  header.estimateNo ?? null)
    .input("得意先コード",    sql.NVarChar(10),  header.customerCode)
    .input("得意先名",        sql.NVarChar(100), header.customerName)
    .input("得意先担当者名",  sql.NVarChar(50),  header.chargeName ?? null)
    .input("お客様注文番号",  sql.NVarChar(50),  header.customerOrderNo ?? null)
    .input("エンドユーザー番号", sql.NVarChar(50), header.endUserNo ?? null)
    .input("入力日付",        sql.Date,          header.inputDate)
    .input("見積日付",        sql.Date,          header.estimateDate ?? null)
    .input("見積合計金額",    sql.Money,         header.details.reduce((s, d) => s + Number(d.totalPrice ?? 0), 0))
    .input("明細件数",        sql.Int,           header.details.length)
    .query(`
      MERGE dbo.WEBデータ確認 AS target
      USING (SELECT @WEB見積ID AS WEB見積ID) AS source
        ON target.WEB見積ID = source.WEB見積ID
      WHEN MATCHED THEN
        UPDATE SET
          WEB見積番号 = @WEB見積番号, 得意先コード = @得意先コード, 得意先名 = @得意先名,
          得意先担当者名 = @得意先担当者名, お客様注文番号 = @お客様注文番号,
          エンドユーザー番号 = @エンドユーザー番号,
          入力日付 = @入力日付, 見積日付 = @見積日付,
          見積合計金額 = @見積合計金額, 明細件数 = @明細件数,
          最終更新日時 = SYSDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (WEB見積ID, WEB見積番号, 得意先コード, 得意先名, 得意先担当者名,
                お客様注文番号, エンドユーザー番号, 入力日付, 見積日付,
                見積合計金額, 明細件数)
        VALUES (@WEB見積ID, @WEB見積番号, @得意先コード, @得意先名, @得意先担当者名,
                @お客様注文番号, @エンドユーザー番号, @入力日付, @見積日付,
                @見積合計金額, @明細件数);
    `);

  // --- 明細 MERGE（行ごと）---
  for (const d of header.details) {
    const useIndiv = d.useIndividualDestination;
    const destDeliveryId = useIndiv ? (d as any).indivDirectDeliveryId ?? null : header.directDeliveryId ?? null;
    const destName = useIndiv ? d.destinationName : header.destinationName;
    const destZip  = useIndiv ? d.destinationZip  : header.destinationZip;
    const destAddr = useIndiv ? d.destinationAddress : header.destinationAddress;
    const destTel  = useIndiv ? d.destinationTel  : header.destinationTel;

    await pool.request()
      .input("WEB見積明細ID", sql.NVarChar(36), d.id)
      .input("WEB見積ID",     sql.NVarChar(36), header.id)
      .input("行番号",        sql.Int,          d.rowNo)
      .input("材料コード",    sql.NVarChar(4),  d.materialCode)
      .input("材料名",        sql.NVarChar(20), d.materialName ?? null)
      .input("加工仕様コード", sql.Int,         d.kakouShiyouCode)
      .input("加工仕様",      sql.NVarChar(10), d.kakouShiyou ?? null)
      .input("加工指示コードT", sql.NVarChar(10), d.kakouShijiCodeT ?? null)
      .input("加工指示コードA", sql.NVarChar(10), d.kakouShijiCodeA ?? null)
      .input("加工指示コードB", sql.NVarChar(10), d.kakouShijiCodeB ?? null)
      .input("仕上りサイズT",  sql.Decimal(7, 3), d.sizeT)
      .input("仕上りサイズA",  sql.Decimal(7, 3), d.sizeA)
      .input("仕上りサイズB",  sql.Decimal(7, 3), d.sizeB)
      .input("加工公差_UT", sql.Decimal(6, 3), d.kousaTUpper ?? null)
      .input("加工公差_LT", sql.Decimal(6, 3), d.kousaTLower ?? null)
      .input("加工公差_UA", sql.Decimal(6, 3), d.kousaAUpper ?? null)
      .input("加工公差_LA", sql.Decimal(6, 3), d.kousaALower ?? null)
      .input("加工公差_UB", sql.Decimal(6, 3), d.kousaBUpper ?? null)
      .input("加工公差_LB", sql.Decimal(6, 3), d.kousaBLower ?? null)
      .input("面取り量_4C", sql.Decimal(5, 2), d.mentori4 ?? null)
      .input("面取り量_8C", sql.Decimal(5, 2), d.mentori8 ?? null)
      .input("製品数量",     sql.Int,           d.quantity)
      .input("見積単価",     sql.Money,         d.unitPrice ?? null)
      .input("見積金額",     sql.Money,         d.totalPrice ?? null)
      .input("最短納期",     sql.VarChar(10),   d.shortestDelivery ?? null)
      .input("納期有効期限", sql.DateTime2,     d.deliveryDeadline ?? null)
      .input("客先注番",     sql.NVarChar(50),  header.customerOrderNo ?? null)
      .input("WEB直送先ID",   sql.NVarChar(36),  destDeliveryId)
      .input("直送先名_WEB入力", sql.NVarChar(100), destName ?? null)
      .input("直送先郵便番号_WEB", sql.NVarChar(10), destZip ?? null)
      .input("直送先住所_WEB", sql.NVarChar(255), destAddr ?? null)
      .input("直送先電話番号_WEB", sql.NVarChar(15), destTel ?? null)
      .query(`
        MERGE dbo.WEBデータ確認明細 AS target
        USING (SELECT @WEB見積明細ID AS WEB見積明細ID) AS source
          ON target.WEB見積明細ID = source.WEB見積明細ID
        WHEN MATCHED THEN
          UPDATE SET
            行番号 = @行番号, 材料コード = @材料コード, 材料名 = @材料名,
            加工仕様コード = @加工仕様コード, 加工仕様 = @加工仕様,
            加工指示コードT = @加工指示コードT, 加工指示コードA = @加工指示コードA, 加工指示コードB = @加工指示コードB,
            仕上りサイズT = @仕上りサイズT, 仕上りサイズA = @仕上りサイズA, 仕上りサイズB = @仕上りサイズB,
            加工公差_UT = @加工公差_UT, 加工公差_LT = @加工公差_LT,
            加工公差_UA = @加工公差_UA, 加工公差_LA = @加工公差_LA,
            加工公差_UB = @加工公差_UB, 加工公差_LB = @加工公差_LB,
            面取り量_4C = @面取り量_4C, 面取り量_8C = @面取り量_8C,
            製品数量 = @製品数量, 見積単価 = @見積単価, 見積金額 = @見積金額,
            最短納期 = @最短納期, 納期有効期限 = @納期有効期限, 客先注番 = @客先注番,
            WEB直送先ID = @WEB直送先ID,
            直送先名_WEB入力 = @直送先名_WEB入力, 直送先郵便番号_WEB = @直送先郵便番号_WEB,
            直送先住所_WEB = @直送先住所_WEB, 直送先電話番号_WEB = @直送先電話番号_WEB,
            -- 直送先スナップショットが変わった場合は再解決させる(取込前のみ)
            直送先解決状態 = CASE WHEN target.取込済フラグ = 1 THEN target.直送先解決状態 ELSE 0 END,
            直送先コード = CASE WHEN target.取込済フラグ = 1 THEN target.直送先コード ELSE NULL END,
            最終更新日時 = SYSDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (WEB見積明細ID, WEB見積ID, 行番号, 材料コード, 材料名,
                  加工仕様コード, 加工仕様, 加工指示コードT, 加工指示コードA, 加工指示コードB,
                  仕上りサイズT, 仕上りサイズA, 仕上りサイズB,
                  加工公差_UT, 加工公差_LT, 加工公差_UA, 加工公差_LA, 加工公差_UB, 加工公差_LB,
                  面取り量_4C, 面取り量_8C, 製品数量, 見積単価, 見積金額,
                  最短納期, 納期有効期限, 客先注番,
                  WEB直送先ID, 直送先名_WEB入力, 直送先郵便番号_WEB, 直送先住所_WEB, 直送先電話番号_WEB)
          VALUES (@WEB見積明細ID, @WEB見積ID, @行番号, @材料コード, @材料名,
                  @加工仕様コード, @加工仕様, @加工指示コードT, @加工指示コードA, @加工指示コードB,
                  @仕上りサイズT, @仕上りサイズA, @仕上りサイズB,
                  @加工公差_UT, @加工公差_LT, @加工公差_UA, @加工公差_LA, @加工公差_UB, @加工公差_LB,
                  @面取り量_4C, @面取り量_8C, @製品数量, @見積単価, @見積金額,
                  @最短納期, @納期有効期限, @客先注番,
                  @WEB直送先ID, @直送先名_WEB入力, @直送先郵便番号_WEB, @直送先住所_WEB, @直送先電話番号_WEB);
      `);
  }
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
