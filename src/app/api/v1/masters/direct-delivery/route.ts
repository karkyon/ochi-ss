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
  const created = await withTenant(ctx.customerId, ctx.isSuperAdmin, (tx) =>
    (tx as any).directDelivery.create({
      data: { ...body, customerId: ctx.customerId, customerCode: ctx.companyCode, isDeleted: false },
    })
  )
  audit({ customerId: ctx.customerId, userId: ctx.userId, action: "CREATE", resource: "direct_deliveries", resourceId: created.id, req })
  return NextResponse.json(created, { status: 201 })
}
