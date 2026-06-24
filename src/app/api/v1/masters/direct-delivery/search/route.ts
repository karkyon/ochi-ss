// src/app/api/v1/masters/direct-delivery/search/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getTenantCtx } from "@/lib/tenant-guard"
import { withTenant } from "@/lib/with-tenant"

export async function GET(req: NextRequest) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const code    = searchParams.get("code")?.trim() ?? ""
  const keyword = searchParams.get("keyword")?.trim() ?? ""

  // コード完全一致検索（出荷先コード入力→ENTER 用）
  if (code) {
    const row = await withTenant(ctx.customerId, ctx.isSuperAdmin, (tx) =>
      (tx as any).directDelivery.findFirst({
        where: { customerId: ctx.customerId, deliveryCode: code, isDeleted: false },
      })
    ) as any
    if (!row) return NextResponse.json({ delivery: null })
    return NextResponse.json({ delivery: row })
  }

  // キーワード部分一致検索（モーダル用）
  const rows = await withTenant(ctx.customerId, ctx.isSuperAdmin, (tx) =>
    (tx as any).directDelivery.findMany({
      where: {
        customerId: ctx.customerId,
        isDeleted: false,
        ...(keyword ? {
          OR: [
            { deliveryCode:  { contains: keyword } },
            { companyName:   { contains: keyword } },
            { departmentName:{ contains: keyword } },
            { contactPerson: { contains: keyword } },
          ],
        } : {}),
      },
      orderBy: { deliveryCode: "asc" },
      take: 50,
    })
  ) as any[]
  return NextResponse.json({ deliveries: rows })
}