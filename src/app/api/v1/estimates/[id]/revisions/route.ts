// src/app/api/v1/estimates/[id]/revisions/route.ts
// ============================================================
// 見積リビジョン履歴 一覧取得API（優先対応3: 見積の版管理）
//   GET /api/v1/estimates/[id]/revisions
//
// PUT /api/v1/estimates/[id] で上書き保存されるたびに作成される
// EstimateRevision(ヘッダー・明細のJSONスナップショット)の一覧を返す。
// 変更点の参照・復元調査に使う想定（削除されない監査証跡）。
// ============================================================

import { NextRequest, NextResponse } from "next/server"
import { getTenantCtx, assertOwner } from "@/lib/tenant-guard"
import { withTenant } from "@/lib/with-tenant"
import { audit } from "@/lib/audit-log"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error
  const { id } = await params

  // テナント所有チェック（他社の見積のリビジョンを見られないようにする）
  const estimate = await withTenant(ctx.customerId, ctx.isSuperAdmin, (tx) =>
    (tx as any).estimateHeader.findFirst({
      where: { id, customerId: ctx.customerId, isDeleted: false },
      select: { id: true, customerId: true, estimateNo: true, version: true },
    })
  )
  const ownerErr = assertOwner(estimate, ctx.customerId, ctx.isSuperAdmin)
  if (ownerErr) return ownerErr

  const revisions = await withTenant(ctx.customerId, ctx.isSuperAdmin, (tx) =>
    (tx as any).estimateRevision.findMany({
      where: { estimateHeaderId: id },
      orderBy: { versionNo: "desc" },
    })
  )

  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "READ", resource: "estimate_revisions", resourceId: id, req })

  return NextResponse.json({
    estimateId: id,
    estimateNo: estimate.estimateNo,
    currentVersion: estimate.version,
    revisions: (revisions as any[]).map((r) => ({
      id: r.id,
      versionNo: r.versionNo,
      changedBy: r.changedBy,
      changeReason: r.changeReason,
      createdAt: r.createdAt,
      headerSnapshot: r.headerSnapshot,
      detailsSnapshot: r.detailsSnapshot,
    })),
  })
}
