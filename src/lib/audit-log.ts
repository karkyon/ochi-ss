// src/lib/audit-log.ts
// 監査ログ記録ユーティリティ
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

export type AuditAction = "READ" | "CREATE" | "UPDATE" | "DELETE" | "EXPORT" | "AUTH"
export type AuditResource =
  | "estimates" | "orders" | "direct_deliveries"
  | "notifications" | "pdf" | "users" | "masters"

interface AuditParams {
  customerId: string
  userId:     string
  action:     AuditAction
  resource:   AuditResource
  resourceId?: string
  req?:        NextRequest
  resultCode?: number
  detail?:     Record<string, unknown>
}

/**
 * 監査ログを非同期で記録（失敗してもメイン処理を止めない）
 */
export async function audit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        customerId: params.customerId,
        userId:     params.userId,
        action:     params.action,
        resource:   params.resource,
        resourceId: params.resourceId ?? null,
        ipAddress:  params.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                    ?? params.req?.headers.get("x-real-ip")
                    ?? null,
        userAgent:  params.req?.headers.get("user-agent")?.slice(0, 300) ?? null,
        resultCode: params.resultCode ?? 200,
        detail:     params.detail ?? null,
      } as any,
    })
  } catch (err) {
    console.error("[audit] 監査ログ記録エラー:", err)
  }
}
