// src/app/api/v1/estimates/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { validateWithZod, estimateHeaderSchema } from "@/lib/zod-schemas"
import { getTenantCtx } from "@/lib/tenant-guard"
import { withTenant } from "@/lib/with-tenant"
import { audit } from "@/lib/audit-log"

// ── GET 見積一覧 ──
export async function GET(req: NextRequest) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error

  const { searchParams } = req.nextUrl
  const dateFrom = searchParams.get("dateFrom")
  const dateTo   = searchParams.get("dateTo")
  const noFrom   = searchParams.get("noFrom")
  const noTo     = searchParams.get("noTo")
  const destName = searchParams.get("destName")
  const orderNo  = searchParams.get("orderNo")
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const perPage  = 20

  const where: Prisma.EstimateHeaderWhereInput = {
    customerId: ctx.customerId,
    isDeleted: false,
    ...(dateFrom && { estimateDate: { gte: new Date(dateFrom) } }),
    ...(dateTo   && { estimateDate: { lte: new Date(dateTo + "T23:59:59") } }),
    ...(noFrom   && { estimateNo: { gte: noFrom } }),
    ...(noTo     && { estimateNo: { lte: noTo } }),
    ...(destName && { destinationName: { contains: destName } }),
    ...(orderNo  && { customerOrderNo: { contains: orderNo } }),
  }

  const [total, rows] = await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {
    return Promise.all([
      (tx as any).estimateHeader.count({ where }),
      (tx as any).estimateHeader.findMany({
        where,
        orderBy: { estimateDate: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true, estimateNo: true, estimateDate: true,
          destinationName: true, estimateStatus: true, customerOrderNo: true,
          details: { where: { isDeleted: false }, select: { totalPrice: true } },
        },
      }),
    ])
  })

  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "READ", resource: "estimates", req })

  const data = (rows as any[]).map((r: any) => ({
    id:              r.id,
    estimateNo:      r.estimateNo ?? "（未採番）",
    estimateDate:    r.estimateDate?.toISOString().slice(0, 10) ?? "",
    destinationName: r.destinationName ?? "",
    estimateStatus:  r.estimateStatus,
    customerOrderNo: r.customerOrderNo ?? "",
    detailCount:     r.details.length,
    totalAmount:     r.details.reduce((sum: number, d: any) => sum + Number(d.totalPrice ?? 0), 0),
  }))

  return NextResponse.json({ total, page, perPage, data })
}

// ── POST 見積新規保存 ──
interface SaveDetailRequest {
  clientDetailId: string; rowNo: number; materialCode: string; materialName?: string
  kakouShiyouCode: number; kakouShiyou?: string
  kakouShijiCodeT?: string; kakouShijiCodeA?: string; kakouShijiCodeB?: string
  kakouT?: string; kakouA?: string; kakouB?: string
  sizeT: number; sizeA: number; sizeB: number
  kousaTUpper?: number|null; kousaTLower?: number|null
  kousaAUpper?: number|null; kousaALower?: number|null
  kousaBUpper?: number|null; kousaBLower?: number|null
  mentoriShiji?: string; mentori4?: number|null; mentori8?: number|null
  quantity: number; unitPrice: number; totalPrice: number
  shortestDelivery?: string; deliveryDeadline?: string|null
  materialSizeT?: number; materialSizeA?: number; materialSizeB?: number
  materialUnitWeight?: number; materialTotalWeight?: number
  productUnitWeight?: number; productTotalWeight?: number
  processingCost6f?: number; processingCostTotal?: number
  // ★2026/07/14 追加: 明細単位の個別直送先
  useIndividualDestination?: boolean
  destinationCode?: string; destinationName?: string; destinationDept?: string
  destinationPerson?: string; destinationZip?: string; destinationAddress?: string
  destinationTel?: string; destinationFax?: string
}
interface SaveHeaderRequest {
  inputDate: string; customerOrderNo?: string; endUserNo?: string
  destinationCode?: string; destinationName?: string; destinationDept?: string
  destinationPerson?: string; destinationZip?: string; destinationAddress?: string
  destinationTel?: string; destinationFax?: string
  shippingMethodId?: number; requestNouki?: string; chargeName?: string; remarks?: string
  editMode: "New"|"Edit"|"Copy"
  details: SaveDetailRequest[]
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error

  let body: SaveHeaderRequest
  try { body = await req.json() }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const validation = validateWithZod(estimateHeaderSchema, {
    inputDate: body.inputDate, customerOrderNo: body.customerOrderNo,
    destinationName: body.destinationName, destinationAddress: body.destinationAddress,
    destinationTel: body.destinationTel, remarks: body.remarks,
  })
  if (!validation.success) return NextResponse.json({ error: validation.errors.join(" / ") }, { status: 422 })
  if (!body.inputDate) return NextResponse.json({ error: "inputDate は必須です" }, { status: 400 })
  if (!body.details?.length) return NextResponse.json({ error: "明細が1件も存在しません" }, { status: 400 })
  const uncalculated = body.details.filter(d => !d.unitPrice || d.unitPrice <= 0)
  if (uncalculated.length > 0)
    return NextResponse.json({ error: `未計算の明細が ${uncalculated.length} 件あります。全明細を計算してから保存してください。` }, { status: 422 })

  async function generateEstimateNo(tx: any, inputDate: string): Promise<string> {
    const d = new Date(inputDate)
    const yyyymmdd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`
    const prefix = `W${yyyymmdd}`
    const last = await tx.estimateHeader.findFirst({
      where: { estimateNo: { startsWith: prefix } },
      orderBy: { estimateNo: "desc" }, select: { estimateNo: true },
    })
    let seq = 1
    if (last?.estimateNo) { const s = parseInt(last.estimateNo.slice(-2), 10); if (!isNaN(s)) seq = s + 1 }
    if (seq > 99) throw new Error("本日の見積番号が上限（99件）に達しました")
    return `${prefix}${String(seq).padStart(2, "0")}`
  }

  try {
    const saved = await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {
      const estimateNo = await generateEstimateNo(tx, body.inputDate)
      const header = await (tx as any).estimateHeader.create({
        data: {
          estimateNo, customerId: ctx.customerId,
          customerCode: (await import("@/lib/auth").then(m => m.auth()))?.user?.companyCode ?? "",
          customerName: (await import("@/lib/auth").then(m => m.auth()))?.user?.customerName ?? "",
          chargeName: body.chargeName ?? null,
          createdBy: ctx.userName || ctx.userId,
          estimateDate: new Date(body.inputDate), inputDate: new Date(body.inputDate),
          customerOrderNo: body.customerOrderNo ?? null, endUserNo: body.endUserNo ?? null,
          destinationCode: body.destinationCode ?? null, destinationName: body.destinationName ?? null,
          destinationDept: body.destinationDept ?? null, destinationPerson: body.destinationPerson ?? null,
          destinationZip: body.destinationZip ?? null, destinationAddress: body.destinationAddress ?? null,
          destinationTel: body.destinationTel ?? null, destinationFax: body.destinationFax ?? null,
          shippingMethodId: body.shippingMethodId ?? null, requestNouki: body.requestNouki ?? null,
          remarks: body.remarks ?? null, estimateStatus: "saved", editMode: "new", isDeleted: false,
        },
      })
      await (tx as any).estimateDetail.createMany({
        data: body.details.map((d) => ({
          estimateHeaderId: header.id, rowNo: d.rowNo,
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
          mentoriShiji: d.mentoriShiji ?? null,
          mentori4: d.mentori4 != null ? new Prisma.Decimal(d.mentori4) : null,
          mentori8: d.mentori8 != null ? new Prisma.Decimal(d.mentori8) : null,
          quantity: d.quantity,
          unitPrice: new Prisma.Decimal(d.unitPrice), totalPrice: new Prisma.Decimal(d.totalPrice),
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
      return header
    })

    audit({ customerId: ctx.customerId, userId: ctx.userId, action: "CREATE", resource: "estimates",
            resourceId: saved.id, req, detail: { estimateNo: saved.estimateNo } })

    try {
      await prisma.outboxEvent.create({
        data: {
          aggregateType: "estimate", aggregateId: saved.id, eventType: "estimate.created",
          payload: { estimateNo: saved.estimateNo, customerCode: ctx.companyCode,
                     destinationName: body.destinationName ?? null, detailCount: body.details?.length ?? 0 },
          status: "pending",
        },
      })
    } catch (e) { console.error("[POST /estimates] outbox:", e) }

    return NextResponse.json({ success: true, estimateId: saved.id, estimateNo: saved.estimateNo }, { status: 201 })
  } catch (err: any) {
    console.error("[estimates POST] 保存エラー:", err)
    return NextResponse.json({ error: "保存中にエラーが発生しました", detail: err.message }, { status: 500 })
  }
}
