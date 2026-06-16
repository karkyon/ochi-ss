// src/app/api/v1/estimates/drafts/route.ts
import { NextResponse } from "next/server"
import { getTenantCtx } from "@/lib/tenant-guard"
import { withTenant } from "@/lib/with-tenant"

export async function GET() {
  const { ctx, error } = await getTenantCtx()
  if (error) return error

  const now = new Date()

  const drafts = await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {
    return (tx as any).estimateHeader.findMany({
      where: {
        customerId:     ctx.customerId,
        estimateStatus: "draft",
        isDeleted:      false,
        OR: [
          { isDraftOnly: true, draftExpiresAt: { gt: now } },
          { isDraftOnly: false },
        ],
      },
      orderBy: { draftSavedAt: "desc" },
      take: 5,
      select: {
        id:              true,
        destinationName: true,
        draftSavedAt:    true,
        draftExpiresAt:  true,
        details: {
          where: { isDeleted: false },
          select: { id: true },
        },
      },
    })
  }) as any[]

  return NextResponse.json({
    drafts: drafts.map((d: any) => ({
      estimateId:     d.id,
      destinationName: d.destinationName ?? null,
      detailCount:    d.details.length,
      draftSavedAt:   d.draftSavedAt?.toISOString() ?? null,
      draftExpiresAt: d.draftExpiresAt?.toISOString() ?? null,
    })),
  })
}
