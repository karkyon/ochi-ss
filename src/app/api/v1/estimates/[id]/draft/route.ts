// src/app/api/v1/estimates/[id]/draft/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getTenantCtx } from "@/lib/tenant-guard"
import { withTenant } from "@/lib/with-tenant"
import { audit } from "@/lib/audit-log"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error
  const { id } = await params

  const existing = await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {
    return (tx as any).estimateHeader.findFirst({
      where: { id, customerId: ctx.customerId, isDeleted: false },
    })
  }) as any

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (existing.estimateStatus !== "draft") {
    return NextResponse.json({ error: "Draft 以外の見積には自動保存できません" }, { status: 422 })
  }

  let body: { headerPartial?: Record<string, unknown>; details?: Record<string, unknown>[]; draftSavedAt?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  if (body.draftSavedAt && existing.draftSavedAt) {
    const clientTs = new Date(body.draftSavedAt).getTime()
    const serverTs = new Date(existing.draftSavedAt).getTime()
    if (clientTs < serverTs) {
      return NextResponse.json({
        error: "conflict",
        serverUpdatedAt: new Date(existing.draftSavedAt).toISOString(),
        message: "別の端末からより新しいデータが保存されています。ページを再読み込みしてください。",
      }, { status: 409 })
    }
  }

  const hp = (body.headerPartial ?? {}) as Record<string, any>
  const now = new Date()
  const draftExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {
    const updateData: Record<string, any> = { draftSavedAt: now, draftExpiresAt }
    if (hp.inputDate)           updateData.inputDate           = new Date(hp.inputDate)
    if (hp.estimateDate)        updateData.estimateDate        = new Date(hp.estimateDate)
    if ("destinationCode"   in hp) updateData.destinationCode   = hp.destinationCode ?? null
    if ("destinationName"   in hp) updateData.destinationName   = hp.destinationName ?? null
    if ("destinationDept"   in hp) updateData.destinationDept   = hp.destinationDept ?? null
    if ("destinationPerson" in hp) updateData.destinationPerson = hp.destinationPerson ?? null
    if ("destinationZip"    in hp) updateData.destinationZip    = hp.destinationZip ?? null
    if ("destinationAddress"in hp) updateData.destinationAddress= hp.destinationAddress ?? null
    if ("destinationTel"    in hp) updateData.destinationTel    = hp.destinationTel ?? null
    if ("destinationFax"    in hp) updateData.destinationFax    = hp.destinationFax ?? null
    if ("customerOrderNo"   in hp) updateData.customerOrderNo   = hp.customerOrderNo ?? null
    if ("endUserNo"         in hp) updateData.endUserNo         = hp.endUserNo ?? null
    if ("contact"           in hp) updateData.remarks           = hp.contact ?? null
    if ("requestNouki"      in hp) updateData.requestNouki      = hp.requestNouki ?? null

    await (tx as any).estimateHeader.update({ where: { id }, data: updateData })

    if (body.details && body.details.length > 0) {
      await (tx as any).estimateDetail.deleteMany({ where: { estimateHeaderId: id } })
      await (tx as any).estimateDetail.createMany({
        data: body.details.map((d: any, i: number) => ({
          estimateHeaderId: id, rowNo: d.rowNo ?? i + 1,
          materialCode: d.materialCode ?? "", materialName: d.materialName ?? null,
          kakouShiyouCode: d.kakouShiyouCode ?? 0, kakouShiyou: d.kakouShiyou ?? null,
          kakouShijiCodeT: d.kakouShijiCodeT ?? null, kakouShijiCodeA: d.kakouShijiCodeA ?? null, kakouShijiCodeB: d.kakouShijiCodeB ?? null,
          kakouT: d.kakouT ?? null, kakouA: d.kakouA ?? null, kakouB: d.kakouB ?? null,
          sizeT: d.sizeT ?? 0, sizeA: d.sizeA ?? 0, sizeB: d.sizeB ?? 0,
          kousaTUpper: d.kousaTUpper ?? null, kousaTLower: d.kousaTLower ?? null,
          kousaAUpper: d.kousaAUpper ?? null, kousaALower: d.kousaALower ?? null,
          kousaBUpper: d.kousaBUpper ?? null, kousaBLower: d.kousaBLower ?? null,
          mentoriShiji: d.mentoriShiji ?? null, mentori4: d.mentori4 ?? null, mentori8: d.mentori8 ?? null,
          quantity: d.quantity ?? 1,
          unitPrice: d.unitPrice ?? 0, totalPrice: d.totalPrice ?? 0,
          shortestDelivery: d.shortestDelivery ?? null,
          deliveryDeadline: d.deliveryDeadline ? new Date(d.deliveryDeadline) : null,
          isDeleted: false,
        })),
      })
    }
  })

  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "UPDATE", resource: "estimates", resourceId: id, req })
  return NextResponse.json({ ok: true, draftSavedAt: now.toISOString(), draftExpiresAt: draftExpiresAt.toISOString() })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error
  const { id } = await params

  await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {
    await (tx as any).estimateHeader.updateMany({
      where: { id, customerId: ctx.customerId, isDraftOnly: true },
      data: { isDeleted: true },
    })
  })

  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "DELETE", resource: "estimates", resourceId: id, req })
  return NextResponse.json({ ok: true })
}
