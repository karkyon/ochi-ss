// src/app/api/v1/estimates/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { validateWithZod, estimateHeaderSchema } from "@/lib/zod-schemas"
import { getTenantCtx, assertOwner } from "@/lib/tenant-guard"
import { withTenant } from "@/lib/with-tenant"
import { audit } from "@/lib/audit-log"
import { revalidateEstimateDetails } from "@/lib/server/estimate-revalidate"

// 楽観的排他制御(優先対応2): 更新対象のversionが一致しなかった場合に投げる。
// withTenantのトランザクションコールバック内でthrowするとロールバックされるため、
// 外側のcatchで捕捉して409を返す。
class OptimisticLockError extends Error {}

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
  if (body.version === undefined || body.version === null || typeof body.version !== "number")
    return NextResponse.json({ error: "version は必須です（画面を再読み込みしてから保存してください）" }, { status: 400 })

  const existing = await withTenant(ctx.customerId, ctx.isSuperAdmin, (tx) =>
    (tx as any).estimateHeader.findFirst({ where: { id, customerId: ctx.customerId, isDeleted: false } })
  )
  const ownerErr = assertOwner(existing, ctx.customerId, ctx.isSuperAdmin)
  if (ownerErr) return ownerErr
  if (existing.estimateStatus === "ordered")
    return NextResponse.json({ error: "注文済みの見積は編集できません" }, { status: 422 })

  // ── サーバー側金額再検証 ──
  // クライアント送信のunitPrice/totalPriceは表示用の参考値に過ぎず、
  // ここでSQL Server側SPを再実行して得た値を正として以降の保存処理に使う。
  // 既に受注済み(isOrdered)の明細は、そもそもここで再作成されない
  // (下のcreateManyでも除外している)ため再検証の対象外とする。
  const detailsToRevalidate = (body.details as any[]).filter((d) => !d.isOrdered)
  const revalidation = await revalidateEstimateDetails(
    detailsToRevalidate.map((d) => ({
      rowNo: d.rowNo, materialCode: d.materialCode, materialName: d.materialName,
      kakouShiyouCode: d.kakouShiyouCode, kakouShiyou: d.kakouShiyou,
      kakouShijiCodeT: d.kakouShijiCodeT, kakouShijiCodeA: d.kakouShijiCodeA, kakouShijiCodeB: d.kakouShijiCodeB,
      sizeT: d.sizeT, sizeA: d.sizeA, sizeB: d.sizeB,
      kousaTUpper: d.kousaTUpper, kousaTLower: d.kousaTLower,
      kousaAUpper: d.kousaAUpper, kousaALower: d.kousaALower,
      kousaBUpper: d.kousaBUpper, kousaBLower: d.kousaBLower,
      mentoriShiji: d.mentoriShiji, mentori4: d.mentori4, mentori8: d.mentori8,
      quantity: d.quantity, unitPrice: d.unitPrice ?? 0, totalPrice: d.totalPrice ?? 0,
      requestNouki: body.requestNouki, endUserNo: body.endUserNo,
    })),
    { sessionId: ctx.userId, tokuisakiCd: ctx.companyCode },
    "Edit"
  )
  if (revalidation.hasError) {
    return NextResponse.json(
      {
        error: "見積金額のサーバー側検証に失敗した明細があります。内容をご確認のうえ、再計算してから保存してください。",
        details: revalidation.results.filter((r) => !r.ok).map((r) => r.reason),
      },
      { status: 422 }
    )
  }

  try {
    await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {
      // ── 見積の版管理(優先対応3) ──
      // 上書きされる直前のヘッダー・明細一式をJSONスナップショットとして保存する。
      // Decimal/Dateはそのままだと@db.Json列に書けないため、
      // JSON.stringify→JSON.parseで純粋なJSON値に変換してから保存する
      // (Prisma.DecimalはtoJSON()を持つため文字列化される)。
      const beforeHeader = await (tx as any).estimateHeader.findUnique({ where: { id } })
      const beforeDetails = await (tx as any).estimateDetail.findMany({
        where: { estimateHeaderId: id, isDeleted: false },
        orderBy: { rowNo: "asc" },
      })
      if (beforeHeader) {
        await (tx as any).estimateRevision.create({
          data: {
            estimateHeaderId: id,
            versionNo: beforeHeader.version,
            headerSnapshot: JSON.parse(JSON.stringify(beforeHeader)),
            detailsSnapshot: JSON.parse(JSON.stringify(beforeDetails)),
            changedBy: ctx.userId,
            changeReason: body.changeReason ?? null,
          },
        })
      }

      const updateResult = await (tx as any).estimateHeader.updateMany({
        // version が取得時と一致する行のみ更新対象にする。
        // 一致件数が0件 = 他ユーザーが先に更新済み(Lost Update防止)。
        where: { id, customerId: ctx.customerId, version: body.version },
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
          version: { increment: 1 },
        },
      })
      if (updateResult.count === 0) {
        throw new OptimisticLockError(
          "他のユーザーがこの見積を先に更新しました。画面を再読み込みしてから、変更内容を確認のうえ再度保存してください。"
        )
      }
      // ★2026/07/14 部分注文対応: 注文済み(orderId設定済み)明細は削除対象から除外し、
      // DBの既存内容をそのまま保持する。
      await (tx as any).estimateDetail.deleteMany({ where: { estimateHeaderId: id, orderId: null } })
      await (tx as any).estimateDetail.createMany({
        // ★2026/07/14 部分注文対応: 注文済み明細(d.isOrdered)はここで再作成しない
        // (DBの既存行をそのまま保持)。rowNoはクライアントが全明細（注文済み含む）に
        // 対して採番した値をそのまま使い、既存の注文済み行のrowNoと衝突しないようにする。
        data: body.details.filter((d: any) => !d.isOrdered).map((d: any) => {
          // サーバー側再計算済みの値を正として使う（クライアント送信値は使わない）
          const verified = revalidation.byRowNo.get(d.rowNo)
          const verifiedUnitPrice = verified?.verifiedUnitPrice ?? d.unitPrice ?? 0
          const verifiedTotalPrice = verified?.verifiedTotalPrice ?? d.totalPrice ?? 0
          const verifiedShortestDelivery = verified?.verifiedShortestDelivery ?? d.shortestDelivery ?? null
          const verifiedDeliveryDeadline = verified?.verifiedDeliveryDeadline ?? null
          return {
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
          unitPrice: new Prisma.Decimal(verifiedUnitPrice),
          totalPrice: new Prisma.Decimal(verifiedTotalPrice),
          shortestDelivery: verifiedShortestDelivery,
          deliveryDeadline: verifiedDeliveryDeadline,
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
          }
        }),
      })
    })

    audit({ customerId: ctx.customerId, userId: ctx.userId, action: "UPDATE", resource: "estimates", resourceId: id, req })
    return NextResponse.json({ success: true, estimateId: id })
  } catch (err: any) {
    if (err instanceof OptimisticLockError) {
      return NextResponse.json({ error: err.message, reasonCode: "CONFLICT" }, { status: 409 })
    }
    console.error("[estimates PUT] 更新エラー:", err)
    return NextResponse.json({ error: "更新中にエラーが発生しました", detail: err.message }, { status: 500 })
  }
}
export { PUT as PATCH }
