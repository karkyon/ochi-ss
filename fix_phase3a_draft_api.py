#!/usr/bin/env python3
# =============================================================
#  fix_phase3a_draft_api.py
#  Phase 3-A: Draft API 実装（新規ファイル3本）
#  Task 3-1-1: POST  /api/v1/estimates/draft
#  Task 3-1-2: PATCH /api/v1/estimates/[id]/draft
#  Task 3-1-3: GET   /api/v1/estimates/drafts
#  Task 3-1-4: DELETE /api/v1/estimates/[id]/draft（同ファイル）
#  Task 3-1-5: 全APIにcustomerId一致確認
# =============================================================

import os, subprocess, sys

ROOT = os.path.expanduser("~/projects/ochi-ss")

def write(path, content):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    if os.path.exists(full):
        print(f"  ⚠️  既存ファイルを上書き: {path}")
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  ✅ 書き込み完了: {path}")

print("=" * 60)
print("  fix_phase3a_draft_api.py")
print("  Phase 3-A: Draft API 新規実装")
print("=" * 60)

# ─────────────────────────────────────────────────────────────
# ① POST /api/v1/estimates/draft（初回Draft作成）
# ─────────────────────────────────────────────────────────────
print("\n[Task 3-1-1] POST /api/v1/estimates/draft")

DRAFT_POST = """\
// src/app/api/v1/estimates/draft/route.ts
// POST /api/v1/estimates/draft — 初回 Draft 作成
//
// リクエスト Body:
//   {
//     headerPartial: { inputDate?, customerOrderNo?, destinationName?, ... },
//     details: [],          // 初回は空配列可
//     isDraftOnly: true
//   }
// レスポンス 201: { estimateId, draftSavedAt, draftExpiresAt }
//
// ルール:
//  - estimateStatus = "draft", isDraftOnly = true
//  - estimateNo = null（番号未採番）
//  - draftExpiresAt = now + 24h
//  - customerId は session から取得（クライアントから受け取らない）

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
  const draftExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24時間後

  // UserAgent から端末情報を簡略取得
  const ua = req.headers.get("user-agent") ?? ""
  const draftDeviceInfo = ua.length > 200 ? ua.slice(0, 200) : ua

  try {
    const header = await prisma.estimateHeader.create({
      data: {
        estimateNo:      null,          // Draft 段階では未採番
        estimateStatus:  "draft",
        isDraftOnly:     true,
        draftExpiresAt,
        draftSavedAt:    now,
        draftDeviceInfo,
        customerId:      session.user.customerId!,
        customerCode:    session.user.companyCode ?? "",
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
          sizeT:            d.sizeT != null ? new Prisma.Decimal(d.sizeT as number) : null,
          sizeA:            d.sizeA != null ? new Prisma.Decimal(d.sizeA as number) : null,
          sizeB:            d.sizeB != null ? new Prisma.Decimal(d.sizeB as number) : null,
          kousaTUpper:      d.kousaTUpper != null ? new Prisma.Decimal(d.kousaTUpper as number) : null,
          kousaTLower:      d.kousaTLower != null ? new Prisma.Decimal(d.kousaTLower as number) : null,
          kousaAUpper:      d.kousaAUpper != null ? new Prisma.Decimal(d.kousaAUpper as number) : null,
          kousaALower:      d.kousaALower != null ? new Prisma.Decimal(d.kousaALower as number) : null,
          kousaBUpper:      d.kousaBUpper != null ? new Prisma.Decimal(d.kousaBUpper as number) : null,
          kousaBLower:      d.kousaBLower != null ? new Prisma.Decimal(d.kousaBLower as number) : null,
          mentori4:         d.mentori4 != null ? new Prisma.Decimal(d.mentori4 as number) : null,
          mentori8:         d.mentori8 != null ? new Prisma.Decimal(d.mentori8 as number) : null,
          quantity:         (d.quantity as number) ?? 0,
          unitPrice:        d.unitPrice != null ? new Prisma.Decimal(d.unitPrice as number) : new Prisma.Decimal(0),
          totalPrice:       d.totalPrice != null ? new Prisma.Decimal(d.totalPrice as number) : new Prisma.Decimal(0),
          shortestDelivery: (d.shortestDelivery as string) ?? null,
          deliveryDeadline: d.deliveryDeadline ? new Date(d.deliveryDeadline as string) : null,
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
# ② PATCH + DELETE /api/v1/estimates/[id]/draft
# ─────────────────────────────────────────────────────────────
print("\n[Task 3-1-2 / 3-1-4] PATCH + DELETE /api/v1/estimates/[id]/draft")

DRAFT_ID = """\
// src/app/api/v1/estimates/[id]/draft/route.ts
// PATCH  /api/v1/estimates/{id}/draft — 自動保存更新（LWW競合チェック付き）
// DELETE /api/v1/estimates/{id}/draft — Draft 破棄（ソフトデリート）
//
// PATCH リクエスト Body:
//   {
//     headerPartial: { ... },
//     details: [ /* 全明細（差分ではなく全量） */ ],
//     draftSavedAt?: "ISO8601"   // クライアント側タイムスタンプ（LWW判定用）
//   }
// PATCH レスポンス 200: { estimateId, draftSavedAt, draftExpiresAt }
// PATCH レスポンス 409: { error: "conflict", serverUpdatedAt, message }
//
// ルール（全メソッド共通）:
//  - customerId 一致確認必須（他ユーザーのDraftは404を返す）

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

// ── PATCH ──
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  // customerId 一致確認（他ユーザーは404）
  const existing = await prisma.estimateHeader.findFirst({
    where: { id, customerId: session.user.customerId!, isDeleted: false },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Draft 以外のステータスには PATCH 不可
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

  // LWW 競合チェック: クライアントタイムスタンプが既存の draftSavedAt より古ければ 409
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
  // 有効期限をリセット（アクセスのたびに24時間延長）
  const draftExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  try {
    await prisma.$transaction(async (tx) => {
      // ヘッダー更新
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

      // 明細: 全量置き換え（既存明細を論理削除 → 新規作成）
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
              sizeT:            d.sizeT != null ? new Prisma.Decimal(d.sizeT as number) : null,
              sizeA:            d.sizeA != null ? new Prisma.Decimal(d.sizeA as number) : null,
              sizeB:            d.sizeB != null ? new Prisma.Decimal(d.sizeB as number) : null,
              kousaTUpper:      d.kousaTUpper != null ? new Prisma.Decimal(d.kousaTUpper as number) : null,
              kousaTLower:      d.kousaTLower != null ? new Prisma.Decimal(d.kousaTLower as number) : null,
              kousaAUpper:      d.kousaAUpper != null ? new Prisma.Decimal(d.kousaAUpper as number) : null,
              kousaALower:      d.kousaALower != null ? new Prisma.Decimal(d.kousaALower as number) : null,
              kousaBUpper:      d.kousaBUpper != null ? new Prisma.Decimal(d.kousaBUpper as number) : null,
              kousaBLower:      d.kousaBLower != null ? new Prisma.Decimal(d.kousaBLower as number) : null,
              mentori4:         d.mentori4 != null ? new Prisma.Decimal(d.mentori4 as number) : null,
              mentori8:         d.mentori8 != null ? new Prisma.Decimal(d.mentori8 as number) : null,
              quantity:         (d.quantity as number) ?? 0,
              unitPrice:        d.unitPrice != null ? new Prisma.Decimal(d.unitPrice as number) : new Prisma.Decimal(0),
              totalPrice:       d.totalPrice != null ? new Prisma.Decimal(d.totalPrice as number) : new Prisma.Decimal(0),
              shortestDelivery: (d.shortestDelivery as string) ?? null,
              deliveryDeadline: d.deliveryDeadline ? new Date(d.deliveryDeadline as string) : null,
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

// ── DELETE ──
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  // customerId 一致確認（他ユーザーは404）
  const existing = await prisma.estimateHeader.findFirst({
    where: { id, customerId: session.user.customerId!, isDeleted: false },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Draft 以外は削除不可
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
# ③ GET /api/v1/estimates/drafts（Draft一覧）
# ─────────────────────────────────────────────────────────────
print("\n[Task 3-1-3] GET /api/v1/estimates/drafts")

DRAFTS_LIST = """\
// src/app/api/v1/estimates/drafts/route.ts
// GET /api/v1/estimates/drafts — 自分の有効期限内 Draft 一覧
//
// レスポンス 200:
//   { drafts: [ { estimateId, destinationName, detailCount, draftSavedAt, draftExpiresAt } ] }
//
// ルール:
//  - isDraftOnly = true かつ draftExpiresAt > now のみ
//  - customerId = session.user.customerId のみ（他ユーザーは混入しない）
//  - 最大5件（降順）

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()

  const drafts = await prisma.estimateHeader.findMany({
    where: {
      customerId:    session.user.customerId!,
      estimateStatus: "draft",
      isDraftOnly:   true,
      isDeleted:     false,
      draftExpiresAt: { gt: now },
    },
    orderBy: { draftSavedAt: "desc" },
    take: 5,
    select: {
      id:              true,
      destinationName: true,
      draftSavedAt:    true,
      draftExpiresAt:  true,
      details: {
        where: { isDeleted: false },
        select: { id: true },
      },
    },
  })

  return NextResponse.json({
    drafts: drafts.map((d) => ({
      estimateId:    d.id,
      destinationName: d.destinationName ?? null,
      detailCount:   d.details.length,
      draftSavedAt:  d.draftSavedAt?.toISOString() ?? null,
      draftExpiresAt: d.draftExpiresAt?.toISOString() ?? null,
    })),
  })
}
"""

write("src/app/api/v1/estimates/drafts/route.ts", DRAFTS_LIST)

# ─────────────────────────────────────────────────────────────
# ④ tsc --noEmit 確認
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
    print(result.stdout)
    print(result.stderr)
    sys.exit(1)

print("\n" + "=" * 60)
print("  Phase 3-A 完了！")
print("  次のコマンドを実行してください:")
print("  git add -A && git commit -m 'feat: Phase3-A Draft API 実装'")
print("  git push")
print("=" * 60)
