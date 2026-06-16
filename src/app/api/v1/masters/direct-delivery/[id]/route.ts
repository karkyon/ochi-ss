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
