// src/app/api/v1/estimates/[id]/draft/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
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

  const hp = body.headerPartial ?? {}
  const now = new Date()
  const draftExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {
    await (tx as any).estimateHeader.update({
      where: { id },
      data: {
        draftSavedAt: now, draftExpiresAt,
        ...(hp.inputDate && { inputDate: new Date(hp.inputDate as string) }),
        ...(hp.estimateDate && { estimateDate: new Date(hp.estimateDate as string) }),
        ...(hp.destinationCode !== undefined && { destinationCode: hp.destinationCode as string|null }),
        ...(hp.destinationName !== undefined && { destinationName: hp.destinationName as string|null }),
        ...(hp.destinationDept !== undefined && { destinationDept: hp.destinationDept as string|null }),
        ...(hp.destinationPerson !== undefined && { destinationPerson: hp.destinationPerson as string|null }),
        ...(hp.destinationZip !== undefined && { destinationZip: hp.destinationZip as string|null }),
        ...(hp.destinationAddress !== undefined && { destinationAddress: hp.destinationAddress as string|null }),
        ...(hp.destinationTel !== undefined && { destinationTel: hp.destinationTel as string|null }),
        ...(hp.destinationFax !== undefined && { destinationFax: hp.destinationFax as string|null }),
        ...(hp.customerOrderNo !== undefined && { customerOrderNo: hp.customerOrderNo as string|null }),
        ...(hp.endUserNo !== undefined && { endUserNo: hp.endUserNo as string|null }),
        ...(hp.contact !== undefined && { remarks: hp.contact as string|null }),
        ...(hp.requestNouki !== undefined && { requestNouki: hp.requestNouki as string|null }),
      },
    })
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
