/**
 * polling.worker.ts
 * 業務（SQL Server）→ Web（PostgreSQL）方向のポーリング Worker
 *
 * - 30秒間隔で WEB進捗通知 テーブルをポーリング
 * - 通知種別で分岐し PostgreSQL へ反映
 *   - status_change   → order_status_histories INSERT + orders UPDATE
 *   - spec_change     → spec_change_histories INSERT + estimate_details UPDATE
 *   - tracking_update → orders.tracking_no UPDATE
 * - 反映後: WEB反映済フラグ=1、WEB反映日時=NOW() を SQL Server 側に UPDATE
 * - 全処理を sync_change_logs に記録
 */

import { PrismaClient, Prisma } from "@prisma/client";
import sql from "mssql";
import { getSqlServerPool } from "../db/sqlserver";

const prisma = new PrismaClient();
const POLL_INTERVAL_MS = parseInt(process.env.BIZPOLL_INTERVAL_MS ?? "30000", 10);

// ---------------------------------------------------------------------------
//  ポーリングの開始
// ---------------------------------------------------------------------------
export async function startBizPoller(): Promise<void> {
  const poll = async () => {
    try {
      await processNewNotifications();
    } catch (err) {
      console.error("[BizPoller] polling error:", err);
    }
  };

  await poll(); // 初回即時
  setInterval(poll, POLL_INTERVAL_MS);
  console.log(`[BizPoller] started (interval: ${POLL_INTERVAL_MS}ms)`);
}

// ---------------------------------------------------------------------------
//  WEB進捗通知 から未反映レコードを取得して処理
// ---------------------------------------------------------------------------
async function processNewNotifications(): Promise<void> {
  const pool = await getSqlServerPool();

  const result = await pool.request().query<SqlNotification>(`
    SELECT TOP 100
      通知ID, WEB受注ID, WEB見積ID, WEB注文番号, 通知種別,
      変更前ステータス, 変更後ステータス,
      変更フィールド名, 変更前値, 変更後値, 変更理由,
      明細行番号, 送り状番号,
      業務見積No, 業務受注No, 業務売上No, 直送先コード,
      担当者, 発生日時
    FROM WEB進捗通知
    WHERE WEB反映済フラグ = 0
    ORDER BY 発生日時 ASC
  `);

  const notifications = result.recordset;
  if (notifications.length === 0) return;

  console.log(`[BizPoller] ${notifications.length} notifications found`);

  for (const notif of notifications) {
    const started = Date.now();
    let success = false;
    let errorMsg: string | undefined;

    try {
      await handleNotification(notif);
      success = true;
    } catch (err: any) {
      errorMsg = err.message ?? String(err);
      console.error(`[BizPoller] failed to process 通知ID=${notif.通知ID}:`, err);
    }

    // SQL Server 側: 反映済フラグを更新
    if (success) {
      await pool.request()
        .input("通知ID", sql.UniqueIdentifier, notif.通知ID)
        .query(`
          UPDATE WEB進捗通知
          SET WEB反映済フラグ = 1, WEB反映日時 = GETDATE()
          WHERE 通知ID = @通知ID
        `);
    }

    // 査証ログ
    await prisma.syncChangeLog.create({
      data: {
        direction: "biz_to_web",
        eventType: notif.通知種別,
        sourceTable: "WEB進捗通知",
        targetTable: resolveTargetTable(notif.通知種別),
        recordId: notif.WEB注文番号,
        payload: notif as any,
        status: success ? "success" : "failed",
        errorMessage: errorMsg,
        durationMs: Date.now() - started,
      },
    });
  }
}

// ---------------------------------------------------------------------------
//  通知種別ごとの処理
// ---------------------------------------------------------------------------
async function handleNotification(notif: SqlNotification): Promise<void> {
  // ★2026/07/16追加: number_assigned は Order.orderNo ではなく
  //   WEB見積ID(EstimateHeader.id)で照合する。取込みは見積単位・
  //   直送先単位で行われ、Orderがまだ存在しない/複数ある場合もあるため。
  if (notif.通知種別 === "number_assigned") {
    await handleNumberAssigned(notif);
    return;
  }

  // 対象の Order を PostgreSQL から取得（既存ロジック、互換維持）
  const order = await prisma.order.findFirst({
    where: { orderNo: notif.WEB注文番号, isDeleted: false },
  });

  if (!order) {
    console.warn(`[BizPoller] order not found: ${notif.WEB注文番号}`);
    return;
  }

  switch (notif.通知種別) {
    case "status_change":
      await handleStatusChange(order, notif);
      break;

    case "spec_change":
      await handleSpecChange(order, notif);
      break;

    case "tracking_update":
      await handleTrackingUpdate(order, notif);
      break;

    default:
      console.warn(`[BizPoller] unknown 通知種別: ${notif.通知種別}`);
  }
}

async function handleNumberAssigned(notif: SqlNotification): Promise<void> {
  if (!notif.WEB見積ID) {
    console.warn(`[BizPoller] number_assigned notification missing WEB見積ID: ${notif.通知ID}`);
    return;
  }

  const header = await prisma.estimateHeader.findUnique({ where: { id: notif.WEB見積ID } });
  if (!header) {
    console.warn(`[BizPoller] estimate header not found for number_assigned: ${notif.WEB見積ID}`);
    return;
  }

  // 見積No（業務側8桁）をヘッダーへ反映（未設定の場合のみ。複数直送先に
  // 分割された場合は最初に届いた見積Noを代表値として保持する）
  if (!header.estimateNo && notif.業務見積No) {
    await prisma.estimateHeader.update({
      where: { id: header.id },
      data: { estimateNo: notif.業務見積No },
    });
  }

  // この見積・この直送先に対応する Order を探して業務受注No/売上Noを反映
  // (部分注文対応のため、estimateHeaderId一致かつまだ業務番号未設定のものへ)
  const order = await prisma.order.findFirst({
    where: { estimateHeaderId: header.id, businessOrderNo: null, isDeleted: false },
    orderBy: { createdAt: "asc" },
  });

  if (order) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        businessOrderNo: notif.業務受注No ?? null,
        businessSalesNo: notif.業務売上No ?? null,
        businessImportedAt: new Date(),
      },
    });

    await prisma.notification.create({
      data: {
        title: "ご注文が業務システムで受付されました",
        content: `注文番号 ${order.orderNo} の受注番号が確定しました（受注No: ${notif.業務受注No ?? "---"}）。`,
        notifType: "info",
        targetCustomers: Prisma.JsonNull,
        publishedAt: new Date(),
        createdBy: "sync_service",
      },
    });
  } else {
    console.warn(`[BizPoller] no matching order found for number_assigned (estimateHeaderId=${header.id})`);
  }
}

async function handleStatusChange(order: any, notif: SqlNotification): Promise<void> {
  await prisma.$transaction([
    // ステータス変更履歴を追記
    prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: notif.変更前ステータス ?? order.orderStatus,
        toStatus: notif.変更後ステータス!,
        changedBy: notif.担当者 ?? "business_system",
        changeSource: "business_system",
        changeReason: notif.変更理由 ?? null,
        trackingNo: notif.送り状番号 ?? null,
      },
    }),
    // orders のステータスを更新
    prisma.order.update({
      where: { id: order.id },
      data: {
        orderStatus: notif.変更後ステータス!,
        ...(notif.送り状番号 ? { trackingNo: notif.送り状番号 } : {}),
      },
    }),
    // 顧客への通知を作成
    prisma.notification.create({
      data: {
        title: `注文ステータスが更新されました`,
        content: `注文番号 ${notif.WEB注文番号} のステータスが「${notif.変更後ステータス}」に変更されました。`,
        notifType: "info",
        targetCustomers: Prisma.JsonNull, // TODO: 対象得意先を絞る
        publishedAt: new Date(),
        createdBy: "sync_service",
      },
    }),
  ]);
}

async function handleSpecChange(order: any, notif: SqlNotification): Promise<void> {
  await prisma.$transaction([
    // 仕様変更履歴を追記
    prisma.specChangeHistory.create({
      data: {
        orderId: order.id,
        rowNo: notif.明細行番号 ?? 0,
        fieldName: notif.変更フィールド名!,
        oldValue: notif.変更前値 ?? null,
        newValue: notif.変更後値!,
        changeReason: notif.変更理由 ?? null,
        changedBy: notif.担当者 ?? "business_system",
        changeSource: "business_system",
      },
    }),
    // 顧客への通知
    prisma.notification.create({
      data: {
        title: `注文仕様が変更されました`,
        content: `注文番号 ${notif.WEB注文番号} の ${notif.変更フィールド名} が変更されました。理由: ${notif.変更理由 ?? "記載なし"}`,
        notifType: "warning",
        targetCustomers: Prisma.JsonNull,
        publishedAt: new Date(),
        createdBy: "sync_service",
      },
    }),
  ]);
}

async function handleTrackingUpdate(order: any, notif: SqlNotification): Promise<void> {
  await prisma.order.update({
    where: { id: order.id },
    data: { trackingNo: notif.送り状番号 ?? null },
  });
}

// ---------------------------------------------------------------------------
//  ヘルパー
// ---------------------------------------------------------------------------
function resolveTargetTable(notifType: string): string {
  switch (notifType) {
    case "status_change":   return "order_status_histories";
    case "spec_change":     return "spec_change_histories";
    case "tracking_update": return "orders";
    default:                return "unknown";
  }
}

// SQL Server WEB進捗通知 レコードの型
interface SqlNotification {
  通知ID: string;
  WEB受注ID?: string;
  WEB見積ID?: string;
  WEB注文番号: string;
  通知種別: string;
  変更前ステータス?: string;
  変更後ステータス?: string;
  変更フィールド名?: string;
  変更前値?: string;
  変更後値?: string;
  変更理由?: string;
  明細行番号?: number;
  送り状番号?: string;
  業務見積No?: string;
  業務受注No?: string;
  業務売上No?: string;
  直送先コード?: string;
  担当者?: string;
  発生日時: Date;
}
