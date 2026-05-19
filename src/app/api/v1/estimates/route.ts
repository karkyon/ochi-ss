// src/app/api/v1/estimates/route.ts
// ============================================================
// GET  /api/v1/estimates  — 見積一覧検索（既存）
// POST /api/v1/estimates  — 見積新規保存（追加）
// ============================================================

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { validateWithZod, estimateHeaderSchema } from "@/lib/zod-schemas"

// ────────────────────────────────────────────────
// GET — 見積一覧（既存そのまま）
// ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const dateFrom  = searchParams.get("dateFrom")
  const dateTo    = searchParams.get("dateTo")
  const noFrom    = searchParams.get("noFrom")
  const noTo      = searchParams.get("noTo")
  const destName  = searchParams.get("destName")
  const orderNo   = searchParams.get("orderNo")
  const page      = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const perPage   = 20

  console.log("[GET /estimates] session.user.customerId:", session.user.customerId)
  console.log("[GET /estimates] 検索条件:", { dateFrom, dateTo, noFrom, noTo, destName, orderNo, page })
  const where: Prisma.EstimateHeaderWhereInput = {
    customerId: session.user.customerId!,
    isDeleted: false,
    ...(dateFrom && { estimateDate: { gte: new Date(dateFrom) } }),
    ...(dateTo   && { estimateDate: { lte: new Date(dateTo + "T23:59:59") } }),
    ...(noFrom   && { estimateNo: { gte: noFrom } }),
    ...(noTo     && { estimateNo: { lte: noTo } }),
    ...(destName && { destinationName: { contains: destName } }),
    ...(orderNo  && { customerOrderNo: { contains: orderNo } }),
  }

  const [total, rows] = await Promise.all([
    prisma.estimateHeader.count({ where }),
    prisma.estimateHeader.findMany({
      where,
      orderBy: { estimateDate: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id:              true,
        estimateNo:      true,
        estimateDate:    true,
        destinationName: true,
        estimateStatus:  true,
        customerOrderNo: true,
        details: {
          where: { isDeleted: false },
          select: { totalPrice: true },
        },
      },
    }),
  ])

  const data = rows.map((r) => ({
    id:              r.id,
    estimateNo:      r.estimateNo ?? "（未採番）",
    estimateDate:    r.estimateDate?.toISOString().slice(0, 10) ?? "",
    destinationName: r.destinationName ?? "",
    estimateStatus:  r.estimateStatus,
    customerOrderNo: r.customerOrderNo ?? "",
    detailCount:     r.details.length,
    totalAmount:     r.details.reduce((sum, d) => sum + Number(d.totalPrice ?? 0), 0),
  }))

  return NextResponse.json({ total, page, perPage, data })
}

// ────────────────────────────────────────────────
// POST — 見積新規保存
// ────────────────────────────────────────────────

interface SaveDetailRequest {
  // 明細識別（クライアント側ID）
  clientDetailId: string
  rowNo: number

  // 材料
  materialCode: string
  materialName?: string

  // 加工仕様
  kakouShiyouCode: number
  kakouShiyou?: string
  kakouShijiCodeT?: string
  kakouShijiCodeA?: string
  kakouShijiCodeB?: string
  kakouT?: string
  kakouA?: string
  kakouB?: string

  // 寸法
  sizeT: number
  sizeA: number
  sizeB: number

  // 公差
  kousaTUpper?: number | null
  kousaTLower?: number | null
  kousaAUpper?: number | null
  kousaALower?: number | null
  kousaBUpper?: number | null
  kousaBLower?: number | null

  // 面取り
  mentoriShiji?: string
  mentori4?: number | null
  mentori8?: number | null

  // 数量・価格（計算済み）
  quantity: number
  unitPrice: number
  totalPrice: number
  shortestDelivery?: string
  deliveryDeadline?: string | null

  // 計算中間値（保存しておく）
  materialSizeT?: number
  materialSizeA?: number
  materialSizeB?: number
  materialUnitWeight?: number
  materialTotalWeight?: number
  productUnitWeight?: number
  productTotalWeight?: number
  processingCost6f?: number
  processingCostTotal?: number

  // 直送先（明細ごとに異なる場合）
  tyokusousakiCd?: string
  tyokusousakiName?: string
  endUserNo?: string
}

interface SaveHeaderRequest {
  // ヘッダー
  inputDate: string
  customerOrderNo?: string
  endUserNo?: string
  destinationCode?: string
  destinationName?: string
  destinationDept?: string
  destinationPerson?: string
  destinationZip?: string
  destinationAddress?: string
  destinationTel?: string
  destinationFax?: string
  shippingMethodId?: number
  requestNouki?: string
  chargeName?: string
  remarks?: string
  editMode: "New" | "Edit" | "Copy"

  details: SaveDetailRequest[]
}

export async function POST(req: NextRequest) {
  // ── 認証 ──
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: SaveHeaderRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  console.log('[POST /estimates] customerId:', session.user.customerId, '明細件数:', body.details?.length)
  // ── バリデーション ──
  // Zod バリデーション
  const validation = validateWithZod(estimateHeaderSchema, {
    inputDate:       body.inputDate,
    customerOrderNo: body.customerOrderNo,
    destinationName: body.destinationName,
    destinationAddress: body.destinationAddress,
    destinationTel:  body.destinationTel,
    remarks:         body.remarks,
  })
  if (!validation.success) {
    return NextResponse.json({ error: validation.errors.join(" / ") }, { status: 422 })
  }

  if (!body.inputDate) {
    return NextResponse.json({ error: "inputDate は必須です" }, { status: 400 })
  }
  if (!body.details || body.details.length === 0) {
    return NextResponse.json({ error: "明細が1件も存在しません" }, { status: 400 })
  }
  // 全明細が計算済みか確認
  const uncalculated = body.details.filter(d => !d.unitPrice || d.unitPrice <= 0)
  if (uncalculated.length > 0) {
    return NextResponse.json(
      { error: `未計算の明細が ${uncalculated.length} 件あります。全明細を計算してから保存してください。` },
      { status: 422 }
    )
  }

  // ── 見積番号採番ロジック ──
  // フォーマット: W + YYYYMMDD + 2桁連番 (例: W2026051701)
  // ※ Prisma.TransactionClient 型は tx として使用
  async function generateEstimateNo(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], inputDate: string): Promise<string> {
    const d = new Date(inputDate)
    const yyyymmdd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
    const prefix = `W${yyyymmdd}`
    const last = await tx.estimateHeader.findFirst({
      where: { estimateNo: { startsWith: prefix } },
      orderBy: { estimateNo: 'desc' },
      select: { estimateNo: true },
    })
    let seq = 1
    if (last?.estimateNo) {
      const lastSeq = parseInt(last.estimateNo.slice(-2), 10)
      if (!isNaN(lastSeq)) seq = lastSeq + 1
    }
    if (seq > 99) throw new Error('本日の見積番号が上限（99件）に達しました')
    return `${prefix}${String(seq).padStart(2, '0')}`
  }

  // ── トランザクション保存 ──
  try {
    const saved = await prisma.$transaction(async (tx) => {
      // 見積番号採番
      const estimateNo = await generateEstimateNo(tx, body.inputDate)
      console.log('[POST /estimates] 採番見積番号:', estimateNo)

      // 見積ヘッダー作成
      const header = await tx.estimateHeader.create({
        data: {
          estimateNo:      estimateNo,
          customerId:      session.user.customerId!,
          customerCode:    session.user.companyCode ?? "",
          customerName:    session.user.customerName ?? "",
          chargeName:      body.chargeName ?? session.user.chargeName ?? null,
          createdBy:       body.chargeName ?? session.user.chargeName ?? session.user.userId ?? "",
          estimateDate:    new Date(body.inputDate),
          inputDate:       new Date(body.inputDate),
          customerOrderNo: body.customerOrderNo ?? null,
          endUserNo:       body.endUserNo ?? null,
          destinationCode: body.destinationCode ?? null,
          destinationName: body.destinationName ?? null,
          destinationDept: body.destinationDept ?? null,
          destinationPerson: body.destinationPerson ?? null,
          destinationZip:  body.destinationZip ?? null,
          destinationAddress: body.destinationAddress ?? null,
          destinationTel:  body.destinationTel ?? null,
          destinationFax:  body.destinationFax ?? null,
          shippingMethodId: body.shippingMethodId ?? null,
          requestNouki:    body.requestNouki ?? null,
          remarks:         body.remarks ?? null,
          estimateStatus:  "saved",
          editMode:        "new",
          isDeleted:       false,
        },
      })

      // 明細一括作成
      await tx.estimateDetail.createMany({
        data: body.details.map((d) => ({
          estimateHeaderId:    header.id,
          rowNo:               d.rowNo,
          materialCode:        d.materialCode,
          materialName:        d.materialName ?? null,
          kakouShiyouCode:     d.kakouShiyouCode,
          kakouShiyou:         d.kakouShiyou ?? null,
          kakouShijiCodeT:     d.kakouShijiCodeT ?? null,
          kakouShijiCodeA:     d.kakouShijiCodeA ?? null,
          kakouShijiCodeB:     d.kakouShijiCodeB ?? null,
          kakouT:              d.kakouT ?? null,
          kakouA:              d.kakouA ?? null,
          kakouB:              d.kakouB ?? null,
          sizeT:               new Prisma.Decimal(d.sizeT),
          sizeA:               new Prisma.Decimal(d.sizeA),
          sizeB:               new Prisma.Decimal(d.sizeB),
          kousaTUpper:         d.kousaTUpper   != null ? new Prisma.Decimal(d.kousaTUpper)  : null,
          kousaTLower:         d.kousaTLower   != null ? new Prisma.Decimal(d.kousaTLower)  : null,
          kousaAUpper:         d.kousaAUpper   != null ? new Prisma.Decimal(d.kousaAUpper)  : null,
          kousaALower:         d.kousaALower   != null ? new Prisma.Decimal(d.kousaALower)  : null,
          kousaBUpper:         d.kousaBUpper   != null ? new Prisma.Decimal(d.kousaBUpper)  : null,
          kousaBLower:         d.kousaBLower   != null ? new Prisma.Decimal(d.kousaBLower)  : null,
          mentoriShiji:        d.mentoriShiji ?? null,
          mentori4:            d.mentori4 != null ? new Prisma.Decimal(d.mentori4) : null,
          mentori8:            d.mentori8 != null ? new Prisma.Decimal(d.mentori8) : null,
          quantity:            d.quantity,
          unitPrice:           new Prisma.Decimal(d.unitPrice),
          totalPrice:          new Prisma.Decimal(d.totalPrice),
          shortestDelivery:    d.shortestDelivery ?? null,
          deliveryDeadline:    d.deliveryDeadline ? new Date(d.deliveryDeadline) : null,
          // 計算中間値
          materialSizeT:       d.materialSizeT   != null ? new Prisma.Decimal(d.materialSizeT)   : null,
          materialSizeA:       d.materialSizeA   != null ? new Prisma.Decimal(d.materialSizeA)   : null,
          materialSizeB:       d.materialSizeB   != null ? new Prisma.Decimal(d.materialSizeB)   : null,
          materialUnitWeight:  d.materialUnitWeight  != null ? new Prisma.Decimal(d.materialUnitWeight)  : null,
          materialTotalWeight: d.materialTotalWeight != null ? new Prisma.Decimal(d.materialTotalWeight) : null,
          productUnitWeight:   d.productUnitWeight   != null ? new Prisma.Decimal(d.productUnitWeight)   : null,
          productTotalWeight:  d.productTotalWeight  != null ? new Prisma.Decimal(d.productTotalWeight)  : null,
          processingCost6f:    d.processingCost6f    != null ? new Prisma.Decimal(d.processingCost6f)    : null,
          processingCostTotal: d.processingCostTotal != null ? new Prisma.Decimal(d.processingCostTotal) : null,
          isDeleted:           false,
        })),
      })

      return header
    })

    // Outbox Event（非同期 — 失敗しても保存は成功扱い）
    try {
      await prisma.outboxEvent.create({
        data: {
          aggregateType: "estimate",
          aggregateId:   saved.id,
          eventType:     "estimate.created",
          payload: {
            estimateNo:      saved.estimateNo,
            customerCode:    session.user.companyCode,
            destinationName: body.destinationName ?? null,
            detailCount:     body.details?.length ?? 0,
          },
          status: "pending",
        },
      })
    } catch (e) { console.error("[POST /estimates] outbox create failed:", e) }

    return NextResponse.json(
      { success: true, estimateId: saved.id, estimateNo: saved.estimateNo },
      { status: 201 }
    )
  } catch (err: any) {
    console.error("[estimates POST] 保存エラー:", err)
    return NextResponse.json(
      { error: "保存中にエラーが発生しました", detail: err.message },
      { status: 500 }
    )
  }
}