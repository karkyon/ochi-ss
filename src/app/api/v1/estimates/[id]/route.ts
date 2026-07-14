// src/app/api/v1/estimates/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { validateWithZod, estimateHeaderSchema } from "@/lib/zod-schemas"
import { getTenantCtx, assertOwner } from "@/lib/tenant-guard"
import { withTenant } from "@/lib/with-tenant"
import { audit } from "@/lib/audit-log"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error
  const { id } = await params

  const estimate = await withTenant(ctx.customerId, ctx.isSuperAdmin, (tx) =>
    (tx as any).estimateHeader.findFirst({
      where: { id, customerId: ctx.customerId, isDeleted: false },
      include: { details: { where: { isDeleted: false }, orderBy: { rowNo: "asc" } } },
    })
  )

  const ownerErr = assertOwner(estimate, ctx.customerId, ctx.isSuperAdmin)
  if (ownerErr) return ownerErr

  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "READ", resource: "estimates", resourceId: id, req })
  return NextResponse.json(estimate)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error
  const { id } = await params

  let body: any
  try { body = await req.json() }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const v = validateWithZod(estimateHeaderSchema, {
    inputDate: body.inputDate, customerOrderNo: body.customerOrderNo,
    destinationName: body.destinationName, remarks: body.remarks,
  })
  if (!v.success) return NextResponse.json({ error: v.errors.join(" / ") }, { status: 422 })
  if (!body.inputDate) return NextResponse.json({ error: "inputDate は必須です" }, { status: 400 })
  if (!body.details?.length) return NextResponse.json({ error: "明細が1件も存在しません" }, { status: 400 })

  const existing = await withTenant(ctx.customerId, ctx.isSuperAdmin, (tx) =>
    (tx as any).estimateHeader.findFirst({ where: { id, customerId: ctx.customerId, isDeleted: false } })
  )
  const ownerErr = assertOwner(existing, ctx.customerId, ctx.isSuperAdmin)
  if (ownerErr) return ownerErr
  if (existing.estimateStatus === "ordered")
    return NextResponse.json({ error: "注文済みの見積は編集できません" }, { status: 422 })

  try {
    await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {
      await (tx as any).estimateHeader.update({
        where: { id },
        data: {
          inputDate: new Date(body.inputDate), estimateDate: new Date(body.inputDate),
          requestNouki: body.requestNouki ?? null, chargeName: body.chargeName ?? null,
          customerOrderNo: body.customerOrderNo ?? null, endUserNo: body.endUserNo ?? null,
          destinationCode: body.destinationCode ?? null, destinationName: body.destinationName ?? null,
          destinationDept: body.destinationDept ?? null, destinationPerson: body.destinationPerson ?? null,
          destinationZip: body.destinationZip ?? null, destinationAddress: body.destinationAddress ?? null,
          destinationTel: body.destinationTel ?? null, destinationFax: body.destinationFax ?? null,
          shippingMethodId: body.shippingMethodId ?? null,
          remarks: body.remarks ?? null, estimateStatus: "saved", editMode: "edit", updatedAt: new Date(),
        },
      })
      // ★2026/07/14 部分注文対応: 注文済み(orderId設定済み)明細は削除対象から除外し、
      // DBの既存内容をそのまま保持する。
      await (tx as any).estimateDetail.deleteMany({ where: { estimateHeaderId: id, orderId: null } })
      await (tx as any).estimateDetail.createMany({
        // ★2026/07/14 部分注文対応: 注文済み明細(d.isOrdered)はここで再作成しない
        // (DBの既存行をそのまま保持)。rowNoはクライアントが全明細（注文済み含む）に
        // 対して採番した値をそのまま使い、既存の注文済み行のrowNoと衝突しないようにする。
        data: body.details.filter((d: any) => !d.isOrdered).map((d: any) => ({
          estimateHeaderId: id, rowNo: d.rowNo,
          materialCode: d.materialCode, materialName: d.materialName ?? null,
          kakouShiyouCode: d.kakouShiyouCode, kakouShiyou: d.kakouShiyou ?? null,
          kakouShijiCodeT: d.kakouShijiCodeT ?? null, kakouShijiCodeA: d.kakouShijiCodeA ?? null,
          kakouShijiCodeB: d.kakouShijiCodeB ?? null,
          kakouT: d.kakouT ?? null, kakouA: d.kakouA ?? null, kakouB: d.kakouB ?? null,
          sizeT: new Prisma.Decimal(d.sizeT), sizeA: new Prisma.Decimal(d.sizeA), sizeB: new Prisma.Decimal(d.sizeB),
          kousaTUpper: d.kousaTUpper != null ? new Prisma.Decimal(d.kousaTUpper) : null,
          kousaTLower: d.kousaTLower != null ? new Prisma.Decimal(d.kousaTLower) : null,
          kousaAUpper: d.kousaAUpper != null ? new Prisma.Decimal(d.kousaAUpper) : null,
          kousaALower: d.kousaALower != null ? new Prisma.Decimal(d.kousaALower) : null,
          kousaBUpper: d.kousaBUpper != null ? new Prisma.Decimal(d.kousaBUpper) : null,
          kousaBLower: d.kousaBLower != null ? new Prisma.Decimal(d.kousaBLower) : null,
          mentori4: d.mentori4 != null ? new Prisma.Decimal(d.mentori4) : null,
          mentori8: d.mentori8 != null ? new Prisma.Decimal(d.mentori8) : null,
          quantity: d.quantity,
          unitPrice: d.unitPrice != null ? new Prisma.Decimal(d.unitPrice) : null,
          totalPrice: d.totalPrice != null ? new Prisma.Decimal(d.totalPrice) : null,
          shortestDelivery: d.shortestDelivery ?? null,
          deliveryDeadline: d.deliveryDeadline ? new Date(d.deliveryDeadline) : null,
          useIndividualDestination: !!d.useIndividualDestination,
          destinationCode: d.useIndividualDestination ? (d.destinationCode ?? null) : null,
          destinationName: d.useIndividualDestination ? (d.destinationName ?? null) : null,
          destinationDept: d.useIndividualDestination ? (d.destinationDept ?? null) : null,
          destinationPerson: d.useIndividualDestination ? (d.destinationPerson ?? null) : null,
          destinationZip: d.useIndividualDestination ? (d.destinationZip ?? null) : null,
          destinationAddress: d.useIndividualDestination ? (d.destinationAddress ?? null) : null,
          destinationTel: d.useIndividualDestination ? (d.destinationTel ?? null) : null,
          destinationFax: d.useIndividualDestination ? (d.destinationFax ?? null) : null,
          materialSizeT: d.materialSizeT != null ? new Prisma.Decimal(d.materialSizeT) : null,
          materialSizeA: d.materialSizeA != null ? new Prisma.Decimal(d.materialSizeA) : null,
          materialSizeB: d.materialSizeB != null ? new Prisma.Decimal(d.materialSizeB) : null,
          materialUnitWeight: d.materialUnitWeight != null ? new Prisma.Decimal(d.materialUnitWeight) : null,
          materialTotalWeight: d.materialTotalWeight != null ? new Prisma.Decimal(d.materialTotalWeight) : null,
          productUnitWeight: d.productUnitWeight != null ? new Prisma.Decimal(d.productUnitWeight) : null,
          productTotalWeight: d.productTotalWeight != null ? new Prisma.Decimal(d.productTotalWeight) : null,
          processingCost6f: d.processingCost6f != null ? new Prisma.Decimal(d.processingCost6f) : null,
          processingCostTotal: d.processingCostTotal != null ? new Prisma.Decimal(d.processingCostTotal) : null,
          isDeleted: false,
        })),
      })
    })

    audit({ customerId: ctx.customerId, userId: ctx.userId, action: "UPDATE", resource: "estimates", resourceId: id, req })
    return NextResponse.json({ success: true, estimateId: id })
  } catch (err: any) {
    console.error("[estimates PUT] 更新エラー:", err)
    return NextResponse.json({ error: "更新中にエラーが発生しました", detail: err.message }, { status: 500 })
  }
}
export { PUT as PATCH }
