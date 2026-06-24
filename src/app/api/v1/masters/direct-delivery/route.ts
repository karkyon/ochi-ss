// src/app/api/v1/masters/direct-delivery/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getTenantCtx } from "@/lib/tenant-guard"
import { withTenant } from "@/lib/with-tenant"
import { audit } from "@/lib/audit-log"

export async function GET(req: NextRequest) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error

  const rows = await withTenant(ctx.customerId, ctx.isSuperAdmin, (tx) =>
    (tx as any).directDelivery.findMany({
      where: { customerId: ctx.customerId, isDeleted: false },
      orderBy: { deliveryCode: "asc" },
    })
  )

  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "READ", resource: "direct_deliveries", req })
  return NextResponse.json({ directDeliveries: rows })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error

  const body = await req.json()

  // deliveryCode 自動採番: 数字3桁連番（001, 002, ...）
  let deliveryCode = (body.deliveryCode ?? "").trim()
  if (!deliveryCode) {
    const rows = await withTenant(ctx.customerId, ctx.isSuperAdmin, (tx) =>
      (tx as any).directDelivery.findMany({
        where: { customerId: ctx.customerId, isDeleted: false },
        select: { deliveryCode: true },
      })
    ) as any[]
    let max = 0
    for (const r of rows) {
      const n = parseInt(r.deliveryCode, 10)
      if (!isNaN(n) && n > max) max = n
    }
    deliveryCode = String(max + 1).padStart(3, "0")
  }

  const created = await withTenant(ctx.customerId, ctx.isSuperAdmin, (tx) =>
    (tx as any).directDelivery.create({
      data: { ...body, deliveryCode, customerId: ctx.customerId, customerCode: ctx.companyCode, isDeleted: false },
    })
  )
  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "CREATE", resource: "direct_deliveries", resourceId: created.id, req })
  return NextResponse.json(created, { status: 201 })
}
