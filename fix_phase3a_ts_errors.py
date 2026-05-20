#!/usr/bin/env python3
# =============================================================
#  fix_phase3a_ts_errors.py
#  TSエラー修正:
#   1. draft/route.ts: customerName 必須フィールド追加
#   2. draft/route.ts + [id]/draft/route.ts:
#      Decimal | null → undefined 変換（既存route.tsと同パターン）
# =============================================================

import os, subprocess, sys

ROOT = os.path.expanduser("~/projects/ochi-ss")

def read(path):
    with open(os.path.join(ROOT, path), "r", encoding="utf-8") as f:
        return f.read()

def write(path, content):
    with open(os.path.join(ROOT, path), "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  ✅ 書き込み完了: {path}")

# ─────────────────────────────────────────────────────────────
# 修正後のファイルを直接書き込む
# ─────────────────────────────────────────────────────────────

# 明細 createMany の data 部分（両ファイル共通の正しいパターン）
DETAIL_ROWS = """\
              data: body.details.map((d, i) => ({
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
            })),"""

DETAIL_ROWS_ID = """\
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
            })),"""

print("=" * 60)
print("  fix_phase3a_ts_errors.py")
print("  Phase 3-A TSエラー修正")
print("=" * 60)

# ─────────────────────────────────────────────────────────────
# ① src/app/api/v1/estimates/draft/route.ts 完全書き直し
# ─────────────────────────────────────────────────────────────
print("\n[Fix 1] draft/route.ts: customerName + Decimal修正")

DRAFT_POST = """\
// src/app/api/v1/estimates/draft/route.ts
// POST /api/v1/estimates/draft — 初回 Draft 作成
//
// リクエスト Body:
//   { headerPartial: { inputDate?, ... }, details: [], isDraftOnly: true }
// レスポンス 201: { estimateId, draftSavedAt, draftExpiresAt }

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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
    const header = await prisma.estimateHeader.create({
      data: {
        estimateNo:      null,
        estimateStatus:  "draft",
        isDraftOnly:     true,
        draftExpiresAt,
        draftSavedAt:    now,
        draftDeviceInfo,
        customerId:      session.user.customerId!,
        customerCode:    session.user.companyCode ?? "",
        customerName:    session.user.customerName ?? "",   // ← 必須フィールド
        createdBy:       session.user.userId ?? "",
        chargeName:      (hp.chargeName as string) ?? session.user.chargeName ?? null,
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
"""

write("src/app/api/v1/estimates/draft/route.ts", DRAFT_POST)

# ─────────────────────────────────────────────────────────────
# ② src/app/api/v1/estimates/[id]/draft/route.ts 完全書き直し
# ─────────────────────────────────────────────────────────────
print("\n[Fix 2] [id]/draft/route.ts: Decimal修正")

DRAFT_ID = """\
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
"""

write("src/app/api/v1/estimates/[id]/draft/route.ts", DRAFT_ID)

# ─────────────────────────────────────────────────────────────
# ③ tsc --noEmit
# ─────────────────────────────────────────────────────────────
print("\n[TypeScript チェック]")
result = subprocess.run(
    ["npx", "tsc", "--noEmit"],
    cwd=ROOT,
    capture_output=True,
    text=True,
)
if result.returncode == 0:
    print("  ✅ tsc --noEmit: エラーなし")
else:
    print("  ❌ tsc エラー:")
    out = result.stdout + result.stderr
    print(out[-4000:] if len(out) > 4000 else out)
    sys.exit(1)

print("\n" + "=" * 60)
print("  TSエラー修正完了！")
print("  次のコマンドを実行:")
print("  git add -A && git commit -m 'fix: Phase3-A TSエラー修正 customerName/Decimal'")
print("  git push")
print("=" * 60)
