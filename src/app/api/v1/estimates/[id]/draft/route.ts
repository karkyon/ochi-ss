// src/app/api/v1/estimates/[id]/draft/route.ts
// PATCH  /api/v1/estimates/{id}/draft — 自動保存更新（LWW競合チェック付き）
// DELETE /api/v1/estimates/{id}/draft — Draft 破棄（ソフトデリート）

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const existing = await prisma.estimateHeader.findFirst({
    where: { id, customerId: session.user.customerId!, isDeleted: false },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (existing.estimateStatus !== "draft") {
    return NextResponse.json(
      { error: "Draft 以外の見積には自動保存できません" },
      { status: 422 }
    )
  }

  let body: {
    headerPartial?: Record<string, unknown>
    details?: Record<string, unknown>[]
    draftSavedAt?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // LWW 競合チェック
  if (body.draftSavedAt && existing.draftSavedAt) {
    const clientTs = new Date(body.draftSavedAt).getTime()
    const serverTs = existing.draftSavedAt.getTime()
    if (clientTs < serverTs) {
      return NextResponse.json(
        {
          error: "conflict",
          serverUpdatedAt: existing.draftSavedAt.toISOString(),
          message: "別の端末からより新しいデータが保存されています。ページを再読み込みしてください。",
        },
        { status: 409 }
      )
    }
  }

  const hp = body.headerPartial ?? {}
  const now = new Date()
  const draftExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  try {
    await prisma.$transaction(async (tx) => {
      await tx.estimateHeader.update({
        where: { id },
        data: {
          draftSavedAt:    now,
          draftExpiresAt,
          chargeName:      hp.chargeName !== undefined ? (hp.chargeName as string | null) : undefined,
          inputDate:       hp.inputDate ? new Date(hp.inputDate as string) : undefined,
          estimateDate:    hp.estimateDate ? new Date(hp.estimateDate as string) : undefined,
          requestNouki:    hp.requestNouki !== undefined ? (hp.requestNouki as string | null) : undefined,
          customerOrderNo: hp.customerOrderNo !== undefined ? (hp.customerOrderNo as string | null) : undefined,
          endUserNo:       hp.endUserNo !== undefined ? (hp.endUserNo as string | null) : undefined,
          destinationCode: hp.destinationCode !== undefined ? (hp.destinationCode as string | null) : undefined,
          destinationName: hp.destinationName !== undefined ? (hp.destinationName as string | null) : undefined,
          destinationDept: hp.destinationDept !== undefined ? (hp.destinationDept as string | null) : undefined,
          destinationPerson: hp.destinationPerson !== undefined ? (hp.destinationPerson as string | null) : undefined,
          destinationZip:  hp.destinationZip !== undefined ? (hp.destinationZip as string | null) : undefined,
          destinationAddress: hp.destinationAddress !== undefined ? (hp.destinationAddress as string | null) : undefined,
          destinationTel:  hp.destinationTel !== undefined ? (hp.destinationTel as string | null) : undefined,
          destinationFax:  hp.destinationFax !== undefined ? (hp.destinationFax as string | null) : undefined,
          remarks:         hp.remarks !== undefined ? (hp.remarks as string | null) : undefined,
        },
      })

      if (Array.isArray(body.details)) {
        await tx.estimateDetail.updateMany({
          where: { estimateHeaderId: id, isDeleted: false },
          data:  { isDeleted: true },
        })

        if (body.details.length > 0) {
          await tx.estimateDetail.createMany({
            data: body.details.map((d, i) => ({
              estimateHeaderId: id,
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
      }
    })

    return NextResponse.json({
      estimateId:    id,
      draftSavedAt:  now.toISOString(),
      draftExpiresAt: draftExpiresAt.toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[PATCH /estimates/:id/draft] エラー:", err)
    return NextResponse.json({ error: "Draft 更新中にエラーが発生しました", detail: msg }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const existing = await prisma.estimateHeader.findFirst({
    where: { id, customerId: session.user.customerId!, isDeleted: false },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!existing.isDraftOnly) {
    return NextResponse.json(
      { error: "Draft フラグが立っていない見積は Draft API では削除できません" },
      { status: 422 }
    )
  }

  await prisma.estimateHeader.update({
    where: { id },
    data: { isDeleted: true },
  })

  return NextResponse.json({ deleted: true, id })
}
