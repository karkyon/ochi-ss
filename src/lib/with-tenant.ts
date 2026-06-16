// src/lib/with-tenant.ts
// PostgreSQL RLS用 — リクエスト毎にテナントコンテキストをDB接続に設定
//
// 使い方:
//   const result = await withTenant(customerId, isSuperAdmin, async (tx) => {
//     return tx.estimateHeader.findMany({ where: { isDeleted: false } })
//     // RLSにより customer_id フィルタは自動適用
//   })
import { prisma } from "@/lib/prisma"
import { PrismaClient } from "@prisma/client"

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

export async function withTenant<T>(
  customerId: string,
  isSuperAdmin: boolean,
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  return (prisma as any).$transaction(async (tx: TxClient) => {
    // RLS用セッション変数をトランザクション内に設定（LOCAL = トランザクション終了で自動リセット）
    await (tx as any).$executeRawUnsafe(
      `SET LOCAL app.current_tenant = '${customerId.replace(/'/g, "''")}'`
    )
    await (tx as any).$executeRawUnsafe(
      `SET LOCAL app.is_super_admin = '${isSuperAdmin ? "true" : "false"}'`
    )
    return fn(tx)
  })
}
