// src/app/api/v1/estimates/draft/route.ts
// POST /api/v1/estimates/draft — 初回 Draft 作成
//
// リクエスト Body:
//   { headerPartial: { inputDate?, ... }, details: [], isDraftOnly: true }
// レスポンス 201: { estimateId, draftSavedAt, draftExpiresAt }

import { NextRequest, NextResponse } from "next/server"
import { getTenantCtx } from "@/lib/tenant-guard"
import { withTenant } from "@/lib/with-tenant"
import { audit } from "@/lib/audit-log"
import { Prisma } from "@prisma/client"

export async function POST(req: NextRequest) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error

  let body: {
    headerPartial?: Record<string, unknown>
    details?: unknown[]
    isDraftOnly?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const hp = body.headerPartial ?? {}
  const now = new Date()
  const draftExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const ua = req.headers.get("user-agent") ?? ""
  const draftDeviceInfo = ua.length > 200 ? ua.slice(0, 200) : ua

  try {
    const header = await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {
    return (tx as any).estimateHeader.create({
      data: {
        estimateNo:      null,
        estimateStatus:  "draft",
        isDraftOnly:     true,
        draftExpiresAt,
        draftSavedAt:    now,
        draftDeviceInfo,
        customerId:      ctx.customerId,
        customerCode:    ctx.companyCode ?? "",
        customerName:    "",   // ← 必須フィールド
        createdBy:       ctx.userId ?? "",
        chargeName:      (hp.chargeName as string) ?? ctx.userName ?? null,
        inputDate:       hp.inputDate ? new Date(hp.inputDate as string) : now,
        estimateDate:    hp.estimateDate ? new Date(hp.estimateDate as string) : now,
        requestNouki:    (hp.requestNouki as string) ?? null,
        customerOrderNo: (hp.customerOrderNo as string) ?? null,
        endUserNo:       (hp.endUserNo as string) ?? null,
        destinationCode: (hp.destinationCode as string) ?? null,
        destinationName: (hp.destinationName as string) ?? null,
        destinationDept: (hp.destinationDept as string) ?? null,
        destinationPerson: (hp.destinationPerson as string) ?? null,
        destinationZip:  (hp.destinationZip as string) ?? null,
        destinationAddress: (hp.destinationAddress as string) ?? null,
        destinationTel:  (hp.destinationTel as string) ?? null,
        destinationFax:  (hp.destinationFax as string) ?? null,
        remarks:         (hp.remarks as string) ?? null,
        isDeleted:       false,
      },
    })

    // 明細がある場合は保存
    if (Array.isArray(body.details) && body.details.length > 0) {
      const details = body.details as Record<string, unknown>[]
      await prisma.estimateDetail.createMany({
        data: details.map((d, i) => ({
          estimateHeaderId: header.id,
          rowNo:            i + 1,
          materialCode:     (d.materialCode as string) ?? "",
          kakouShiyouCode:  (d.kakouShiyouCode as number) ?? 0,
          kakouShijiCodeT:  (d.kakouShijiCodeT as string) ?? null,
          kakouShijiCodeA:  (d.kakouShijiCodeA as string) ?? null,
          kakouShijiCodeB:  (d.kakouShijiCodeB as string) ?? null,
          sizeT:            new Prisma.Decimal((d.sizeT as number) ?? 0),
          sizeA:            new Prisma.Decimal((d.sizeA as number) ?? 0),
          sizeB:            new Prisma.Decimal((d.sizeB as number) ?? 0),
          kousaTUpper:      d.kousaTUpper != null ? new Prisma.Decimal(d.kousaTUpper as number) : undefined,
          kousaTLower:      d.kousaTLower != null ? new Prisma.Decimal(d.kousaTLower as number) : undefined,
          kousaAUpper:      d.kousaAUpper != null ? new Prisma.Decimal(d.kousaAUpper as number) : undefined,
          kousaALower:      d.kousaALower != null ? new Prisma.Decimal(d.kousaALower as number) : undefined,
          kousaBUpper:      d.kousaBUpper != null ? new Prisma.Decimal(d.kousaBUpper as number) : undefined,
          kousaBLower:      d.kousaBLower != null ? new Prisma.Decimal(d.kousaBLower as number) : undefined,
          mentori4:         d.mentori4 != null ? new Prisma.Decimal(d.mentori4 as number) : undefined,
          mentori8:         d.mentori8 != null ? new Prisma.Decimal(d.mentori8 as number) : undefined,
          quantity:         (d.quantity as number) ?? 0,
          unitPrice:        d.unitPrice != null ? new Prisma.Decimal(d.unitPrice as number) : undefined,
          totalPrice:       d.totalPrice != null ? new Prisma.Decimal(d.totalPrice as number) : undefined,
          shortestDelivery: (d.shortestDelivery as string) ?? null,
          deliveryDeadline: d.deliveryDeadline ? new Date(d.deliveryDeadline as string) : undefined,
          isDeleted:        false,
        })),
      })
    }

    return NextResponse.json(
      {
        estimateId:    header.id,
        draftSavedAt:  header.draftSavedAt?.toISOString(),
        draftExpiresAt: header.draftExpiresAt?.toISOString(),
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[POST /estimates/draft] エラー:", err)
    return NextResponse.json({ error: "Draft 作成中にエラーが発生しました", detail: msg }, { status: 500 })
  }
}
