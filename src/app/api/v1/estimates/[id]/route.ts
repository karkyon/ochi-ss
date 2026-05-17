// src/app/api/v1/estimates/[id]/route.ts
// PUT /api/v1/estimates/{id} — 見積更新（EditMode=Edit）

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  console.log('[GET /estimates/:id] id:', id)

  const estimate = await prisma.estimateHeader.findFirst({
    where: { id, customerId: session.user.userId!, isDeleted: false },
    include: {
      details: { where: { isDeleted: false }, orderBy: { rowNo: "asc" } },
    },
  })

  if (!estimate) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(estimate)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  console.log('[PUT /estimates/:id] id:', id)
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body.inputDate) {
    return NextResponse.json({ error: "inputDate は必須です" }, { status: 400 })
  }
  if (!body.details || body.details.length === 0) {
    return NextResponse.json({ error: "明細が1件も存在しません" }, { status: 400 })
  }

  // 本人のデータか確認
  const existing = await prisma.estimateHeader.findFirst({
    where: { id, customerId: session.user.userId!, isDeleted: false },
  })
  if (!existing) return NextResponse.json({ error: "見積が見つかりません" }, { status: 404 })
  if (existing.estimateStatus === "ordered") {
    return NextResponse.json({ error: "注文済みの見積は編集できません" }, { status: 422 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      // ヘッダー更新
      await tx.estimateHeader.update({
        where: { id },
        data: {
          inputDate:         new Date(body.inputDate),
          estimateDate:      new Date(body.inputDate),
          customerOrderNo:   body.customerOrderNo ?? null,
          endUserNo:         body.endUserNo ?? null,
          destinationCode:   body.destinationCode ?? null,
          destinationName:   body.destinationName ?? null,
          destinationDept:   body.destinationDept ?? null,
          destinationPerson: body.destinationPerson ?? null,
          destinationZip:    body.destinationZip ?? null,
          destinationAddress: body.destinationAddress ?? null,
          destinationTel:    body.destinationTel ?? null,
          destinationFax:    body.destinationFax ?? null,
          remarks:           body.remarks ?? null,
          estimateStatus:    "saved",
          editMode:          "edit",
          updatedAt:         new Date(),
        },
      })

      // 既存明細を全て論理削除
      await tx.estimateDetail.updateMany({
        where: { estimateHeaderId: id },
        data:  { isDeleted: true },
      })

      // 明細を再INSERT
      await tx.estimateDetail.createMany({
        data: body.details.map((d: any, idx: number) => ({
          estimateHeaderId: id,
          rowNo:            idx + 1,
          materialCode:     d.materialCode,
          materialName:     d.materialName ?? null,
          kakouShiyouCode:  d.kakouShiyouCode,
          kakouShiyou:      d.kakouShiyou ?? null,
          kakouShijiCodeT:  d.kakouShijiCodeT ?? null,
          kakouShijiCodeA:  d.kakouShijiCodeA ?? null,
          kakouShijiCodeB:  d.kakouShijiCodeB ?? null,
          kakouT:           d.kakouT ?? null,
          kakouA:           d.kakouA ?? null,
          kakouB:           d.kakouB ?? null,
          sizeT:            new Prisma.Decimal(d.sizeT),
          sizeA:            new Prisma.Decimal(d.sizeA),
          sizeB:            new Prisma.Decimal(d.sizeB),
          kousaTUpper:      d.kousaTUpper != null ? new Prisma.Decimal(d.kousaTUpper) : null,
          kousaTLower:      d.kousaTLower != null ? new Prisma.Decimal(d.kousaTLower) : null,
          kousaAUpper:      d.kousaAUpper != null ? new Prisma.Decimal(d.kousaAUpper) : null,
          kousaALower:      d.kousaALower != null ? new Prisma.Decimal(d.kousaALower) : null,
          kousaBUpper:      d.kousaBUpper != null ? new Prisma.Decimal(d.kousaBUpper) : null,
          kousaBLower:      d.kousaBLower != null ? new Prisma.Decimal(d.kousaBLower) : null,
          mentori4:         d.mentori4 != null ? new Prisma.Decimal(d.mentori4) : null,
          mentori8:         d.mentori8 != null ? new Prisma.Decimal(d.mentori8) : null,
          quantity:         d.quantity,
          unitPrice:        d.unitPrice != null ? new Prisma.Decimal(d.unitPrice) : null,
          totalPrice:       d.totalPrice != null ? new Prisma.Decimal(d.totalPrice) : null,
          shortestDelivery: d.shortestDelivery ?? null,
          deliveryDeadline: d.deliveryDeadline ? new Date(d.deliveryDeadline) : null,
          materialSizeT:    d.materialSizeT    != null ? new Prisma.Decimal(d.materialSizeT)    : null,
          materialSizeA:    d.materialSizeA    != null ? new Prisma.Decimal(d.materialSizeA)    : null,
          materialSizeB:    d.materialSizeB    != null ? new Prisma.Decimal(d.materialSizeB)    : null,
          materialUnitWeight:  d.materialUnitWeight  != null ? new Prisma.Decimal(d.materialUnitWeight)  : null,
          materialTotalWeight: d.materialTotalWeight != null ? new Prisma.Decimal(d.materialTotalWeight) : null,
          productUnitWeight:   d.productUnitWeight   != null ? new Prisma.Decimal(d.productUnitWeight)   : null,
          productTotalWeight:  d.productTotalWeight  != null ? new Prisma.Decimal(d.productTotalWeight)  : null,
          processingCost6f:    d.processingCost6f    != null ? new Prisma.Decimal(d.processingCost6f)    : null,
          processingCostTotal: d.processingCostTotal != null ? new Prisma.Decimal(d.processingCostTotal) : null,
          isDeleted: false,
        })),
      })
    })

    return NextResponse.json({ success: true, estimateId: id })
  } catch (err: any) {
    console.error("[estimates PUT] 更新エラー:", err)
    return NextResponse.json(
      { error: "更新中にエラーが発生しました", detail: err.message },
      { status: 500 }
    )
  }
}