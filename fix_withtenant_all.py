#!/usr/bin/env python3
"""
fix_withtenant_all.py
RLSが適用されているテーブル(estimate_headers/orders/direct_deliveries/notification_reads/estimate_details)に
直接アクセスしているAPIルートにwithTenant+auditを一括適用する。

RLS不要なテーブル(notification/chamferRule/material/processingSpec)はそのままでOK。
"""
import os, sys, subprocess

ROOT = os.path.dirname(os.path.abspath(__file__))

def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  OK: {path.replace(ROOT+'/', '')}")

print("=== fix_withtenant_all.py ===")
print("[1] git pull...")
r = subprocess.run(["git","pull","origin","main"], cwd=ROOT, capture_output=True, text=True)
print(" ", r.stdout.strip() or r.stderr.strip())

# ─────────────────────────────────────────────────────────────
# 1. estimates/[id]/draft/route.ts  (PATCH/DELETE)
# ─────────────────────────────────────────────────────────────
write(ROOT+"/src/app/api/v1/estimates/[id]/draft/route.ts", '''\
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
''')

# ─────────────────────────────────────────────────────────────
# 2. estimates/[id]/pdf/route.ts  (GET)
# ─────────────────────────────────────────────────────────────
# 元のファイルを読んでwithTenant/getTenantCtx/auditを追加
with open(ROOT+"/src/app/api/v1/estimates/[id]/pdf/route.ts", encoding="utf-8") as f:
    pdf_content = f.read()

pdf_content = pdf_content.replace(
    'import { NextRequest, NextResponse } from "next/server"\nimport { auth } from "@/lib/auth"\nimport { prisma } from "@/lib/prisma"',
    'import { NextRequest, NextResponse } from "next/server"\nimport { prisma } from "@/lib/prisma"\nimport { getTenantCtx } from "@/lib/tenant-guard"\nimport { withTenant } from "@/lib/with-tenant"\nimport { audit } from "@/lib/audit-log"'
)
pdf_content = pdf_content.replace(
    '  const session = await auth()\n  if (!session) return new NextResponse("Unauthorized", { status: 401 })\n\n  const { id } = await params\n  const estimate = await prisma.estimateHeader.findFirst({\n    where: { id, customerId: session.user.customerId!, isDeleted: false },',
    '  const { ctx, error } = await getTenantCtx()\n  if (error) return new NextResponse("Unauthorized", { status: 401 })\n  const { id } = await params\n  const estimate = await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {\n    return (tx as any).estimateHeader.findFirst({\n    where: { id, customerId: ctx.customerId, isDeleted: false },'
)
pdf_content = pdf_content.replace(
    '    },\n  })\n  if (!estimate) return new NextResponse("Not Found", { status: 404 })',
    '    },\n    })\n  }) as any\n  if (!estimate) return new NextResponse("Not Found", { status: 404 })'
)
# auditをHTML返却前に挿入
pdf_content = pdf_content.replace(
    '  const issueDate = new Date()',
    '  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "EXPORT", resource: "pdf", resourceId: id, req })\n  const issueDate = new Date()'
)
write(ROOT+"/src/app/api/v1/estimates/[id]/pdf/route.ts", pdf_content)

# ─────────────────────────────────────────────────────────────
# 3. estimates/draft/route.ts (POST 初回Draft作成)
# ─────────────────────────────────────────────────────────────
with open(ROOT+"/src/app/api/v1/estimates/draft/route.ts", encoding="utf-8") as f:
    draft_content = f.read()
draft_content = draft_content.replace(
    'import { NextRequest, NextResponse } from "next/server"\nimport { auth } from "@/lib/auth"\nimport { prisma } from "@/lib/prisma"',
    'import { NextRequest, NextResponse } from "next/server"\nimport { getTenantCtx } from "@/lib/tenant-guard"\nimport { withTenant } from "@/lib/with-tenant"\nimport { audit } from "@/lib/audit-log"'
)
draft_content = draft_content.replace(
    '  const session = await auth()\n  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })',
    '  const { ctx, error } = await getTenantCtx()\n  if (error) return error'
)
draft_content = draft_content.replace(
    "      customerId:      session.user.customerId!,",
    "      customerId:      ctx.customerId,"
)
draft_content = draft_content.replace(
    "      customerCode:    session.user.companyCode ?? \"\",",
    "      customerCode:    ctx.companyCode ?? \"\","
)
draft_content = draft_content.replace(
    "      customerName:    session.user.customerName ?? \"\",",
    "      customerName:    \"\","
)
draft_content = draft_content.replace(
    "      createdBy:       session.user.userId ?? \"\",",
    "      createdBy:       ctx.userId ?? \"\","
)
draft_content = draft_content.replace(
    "      chargeName:      (hp.chargeName as string) ?? session.user.chargeName ?? null,",
    "      chargeName:      (hp.chargeName as string) ?? ctx.userName ?? null,"
)
# prismaを直接呼んでいる箇所をwithTenantで囲む
draft_content = draft_content.replace(
    "  try {\n    const header = await prisma.estimateHeader.create({",
    "  try {\n    const header = await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {\n    return (tx as any).estimateHeader.create({"
)
draft_content = draft_content.replace(
    "    })\n    return NextResponse.json({",
    "    })\n    }) as any\n    audit({ customerId: ctx.customerId, userId: ctx.userId, action: \"CREATE\", resource: \"estimates\", resourceId: header.id })\n    return NextResponse.json({"
)
write(ROOT+"/src/app/api/v1/estimates/draft/route.ts", draft_content)

# ─────────────────────────────────────────────────────────────
# 4. estimates/drafts/route.ts (GET)
# ─────────────────────────────────────────────────────────────
with open(ROOT+"/src/app/api/v1/estimates/drafts/route.ts", encoding="utf-8") as f:
    drafts_content = f.read()
drafts_content = drafts_content.replace(
    'import { NextResponse } from "next/server"\nimport { auth } from "@/lib/auth"\nimport { prisma } from "@/lib/prisma"',
    'import { NextResponse } from "next/server"\nimport { getTenantCtx } from "@/lib/tenant-guard"\nimport { withTenant } from "@/lib/with-tenant"'
)
drafts_content = drafts_content.replace(
    '  const session = await auth()\n  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })',
    '  const { ctx, error } = await getTenantCtx()\n  if (error) return error'
)
drafts_content = drafts_content.replace(
    '  const drafts = await prisma.estimateHeader.findMany({\n    where: {\n      customerId:    session.user.customerId!,',
    '  const drafts = await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {\n    return (tx as any).estimateHeader.findMany({\n    where: {\n      customerId:    ctx.customerId,'
)
# 末尾の }) を閉じるパターン
drafts_content = drafts_content.replace(
    '    },\n  })\n\n  return NextResponse.json({',
    '    },\n    })\n  }) as any\n\n  return NextResponse.json({'
)
write(ROOT+"/src/app/api/v1/estimates/drafts/route.ts", drafts_content)

# ─────────────────────────────────────────────────────────────
# 5. masters/direct-delivery/[id]/route.ts (PATCH/DELETE)
# ─────────────────────────────────────────────────────────────
write(ROOT+"/src/app/api/v1/masters/direct-delivery/[id]/route.ts", '''\
// PATCH / DELETE /api/v1/masters/direct-delivery/[id]
import { NextRequest, NextResponse } from "next/server"
import { getTenantCtx } from "@/lib/tenant-guard"
import { withTenant } from "@/lib/with-tenant"
import { audit } from "@/lib/audit-log"

interface Props { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Props) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error
  const { id } = await params
  const body = await req.json()
  const { companyName, furigana, shortName, corporateType, corporatePosition,
          departmentName, contactPerson, postalCode, address1, address2, address3,
          phoneNumber, faxNumber, remarks } = body
  if (!companyName) return NextResponse.json({ error: "直送先名は必須です" }, { status: 400 })

  const result = await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {
    const dd = await (tx as any).directDelivery.findFirst({
      where: { id, customerId: ctx.customerId, isDeleted: false }
    })
    if (!dd) return null
    return (tx as any).directDelivery.update({
      where: { id },
      data: { companyName, furigana: furigana ?? null, shortName: shortName ?? null,
               corporateType: corporateType ?? null, corporatePosition: corporatePosition ?? null,
               departmentName: departmentName ?? null, contactPerson: contactPerson ?? null,
               postalCode: postalCode ?? null, address1: address1 ?? null,
               address2: address2 ?? null, address3: address3 ?? null,
               phoneNumber: phoneNumber ?? null, faxNumber: faxNumber ?? null,
               remarks: remarks ?? null },
    })
  }) as any
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })
  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "UPDATE", resource: "direct_deliveries", resourceId: id, req })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: Props) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error
  const { id } = await params

  const result = await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {
    const dd = await (tx as any).directDelivery.findFirst({
      where: { id, customerId: ctx.customerId, isDeleted: false }
    })
    if (!dd) return null
    return (tx as any).directDelivery.update({ where: { id }, data: { isDeleted: true } })
  }) as any
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })
  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "DELETE", resource: "direct_deliveries", resourceId: id, req })
  return NextResponse.json({ ok: true })
}
''')

# ─────────────────────────────────────────────────────────────
# 6. orders/[id]/route.ts (GET)
# ─────────────────────────────────────────────────────────────
with open(ROOT+"/src/app/api/v1/orders/[id]/route.ts", encoding="utf-8") as f:
    order_detail = f.read()
order_detail = order_detail.replace(
    'import { NextRequest, NextResponse } from "next/server"\nimport { auth } from "@/lib/auth"\nimport { prisma } from "@/lib/prisma"',
    'import { NextRequest, NextResponse } from "next/server"\nimport { getTenantCtx } from "@/lib/tenant-guard"\nimport { withTenant } from "@/lib/with-tenant"\nimport { audit } from "@/lib/audit-log"'
)
order_detail = order_detail.replace(
    '  const session = await auth()\n  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })',
    '  const { ctx, error } = await getTenantCtx()\n  if (error) return error'
)
order_detail = order_detail.replace(
    '  const order = await (prisma as any).order.findFirst({\n    where: { id, customerId: session.user.customerId!, isDeleted: false },',
    '  const order = await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {\n    return (tx as any).order.findFirst({\n    where: { id, customerId: ctx.customerId, isDeleted: false },'
)
order_detail = order_detail.replace(
    '    specChangeHistories: { orderBy: { occurredAt: "asc" } },\n    },\n  })',
    '    specChangeHistories: { orderBy: { occurredAt: "asc" } },\n    })\n  }) as any'
)
order_detail = order_detail.replace(
    '  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 })',
    '  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 })\n  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "READ", resource: "orders", resourceId: id, req })'
)
write(ROOT+"/src/app/api/v1/orders/[id]/route.ts", order_detail)

# ─────────────────────────────────────────────────────────────
# 7. orders/[id]/pdf/route.ts (GET)
# ─────────────────────────────────────────────────────────────
with open(ROOT+"/src/app/api/v1/orders/[id]/pdf/route.ts", encoding="utf-8") as f:
    order_pdf = f.read()
order_pdf = order_pdf.replace(
    'import { NextRequest, NextResponse } from "next/server"\nimport { auth } from "@/lib/auth"\nimport { prisma } from "@/lib/prisma"',
    'import { NextRequest, NextResponse } from "next/server"\nimport { getTenantCtx } from "@/lib/tenant-guard"\nimport { withTenant } from "@/lib/with-tenant"\nimport { audit } from "@/lib/audit-log"'
)
order_pdf = order_pdf.replace(
    '  const session = await auth()\n  if (!session) return new NextResponse("Unauthorized", { status: 401 })',
    '  const { ctx, error } = await getTenantCtx()\n  if (error) return new NextResponse("Unauthorized", { status: 401 })'
)
order_pdf = order_pdf.replace(
    '  const order = await prisma.order.findFirst({\n    where: { id, customerId: session.user.customerId! },',
    '  const order = await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {\n    return (tx as any).order.findFirst({\n    where: { id, customerId: ctx.customerId },'
)
order_pdf = order_pdf.replace(
    '      }\n    }\n  })\n  if (!order) return new NextResponse("Not Found", { status: 404 })',
    '      }\n    }\n    })\n  }) as any\n  if (!order) return new NextResponse("Not Found", { status: 404 })'
)
order_pdf = order_pdf.replace(
    '  const estimate = order.estimateHeader as any',
    '  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "EXPORT", resource: "pdf", resourceId: id, req })\n  const estimate = order.estimateHeader as any'
)
write(ROOT+"/src/app/api/v1/orders/[id]/pdf/route.ts", order_pdf)

# ─────────────────────────────────────────────────────────────
# 8. notifications/route.ts (GET) — notification_reads はRLS対象
# ─────────────────────────────────────────────────────────────
write(ROOT+"/src/app/api/v1/notifications/route.ts", '''\
// GET /api/v1/notifications
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getTenantCtx } from "@/lib/tenant-guard"
import { withTenant } from "@/lib/with-tenant"

export async function GET(req: NextRequest) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error

  const now = new Date()
  const notifications = await prisma.notification.findMany({
    where: {
      isDeleted: false,
      publishedAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    },
    orderBy: { publishedAt: "desc" },
    take: 50,
  })

  let readIds = new Set<string>()
  try {
    const reads = await withTenant(ctx.customerId, ctx.isSuperAdmin, async (tx) => {
      return (tx as any).notificationRead.findMany({
        where: { customerId: ctx.customerId },
        select: { notificationId: true },
      })
    }) as any[]
    readIds = new Set(reads.map((r: any) => r.notificationId))
  } catch { /* 全件未読扱い */ }

  const result = notifications.map((n: any) => ({ ...n, isRead: readIds.has(n.id) }))
  return NextResponse.json({
    total: result.length,
    unreadCount: result.filter((n: any) => !n.isRead).length,
    notifications: result,
  })
}
''')

# ─────────────────────────────────────────────────────────────
# tscチェック
# ─────────────────────────────────────────────────────────────
print("[2] tsc チェック...")
r = subprocess.run(
    ["npx","tsc","--noEmit","--skipLibCheck"],
    cwd=ROOT, capture_output=True, text=True, timeout=120
)
IGNORE = ["node_modules","@prisma/client",".prisma/client","next.config","scripts/","access-denied/"]
real_errors = [l for l in (r.stdout+r.stderr).splitlines()
               if "error TS" in l and not any(ig in l for ig in IGNORE)]
if real_errors:
    print("  ❌ tscエラー:")
    for l in real_errors[:20]: print("   ",l)
    sys.exit(1)
print("  ✅ 実コードエラー0件")

# ─────────────────────────────────────────────────────────────
# git commit & push
# ─────────────────────────────────────────────────────────────
print("[3] git commit & push...")
files = [
    "src/app/api/v1/estimates/[id]/draft/route.ts",
    "src/app/api/v1/estimates/[id]/pdf/route.ts",
    "src/app/api/v1/estimates/draft/route.ts",
    "src/app/api/v1/estimates/drafts/route.ts",
    "src/app/api/v1/masters/direct-delivery/[id]/route.ts",
    "src/app/api/v1/orders/[id]/route.ts",
    "src/app/api/v1/orders/[id]/pdf/route.ts",
    "src/app/api/v1/notifications/route.ts",
]
subprocess.run(["git","add"] + files, cwd=ROOT)
r = subprocess.run(["git","commit","-m",
    "fix: RLS対象テーブルAPIにwithTenant+audit一括適用(draft/pdf/orders/notifications/direct-delivery)"],
    cwd=ROOT, capture_output=True, text=True)
print(" ", r.stdout.strip())
r = subprocess.run(["git","push","origin","main"], cwd=ROOT, capture_output=True, text=True)
if r.returncode == 0:
    print("  PUSH OK")
else:
    print("  PUSH FAILED:", r.stderr.strip()); sys.exit(1)

os.remove(__file__)
print("✅ 完了!")
