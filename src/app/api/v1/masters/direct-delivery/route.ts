// POST /api/v1/masters/direct-delivery — 新規登録
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { validateWithZod, directDeliverySchema } from "@/lib/zod-schemas"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const { deliveryCode, companyName, departmentName, contactPerson, postalCode, address1, phoneNumber, faxNumber, remarks } = body
  const validation = validateWithZod(directDeliverySchema, { deliveryCode, companyName, departmentName, contactPerson, postalCode, address1, phoneNumber, faxNumber, remarks })
  if (!validation.success) return NextResponse.json({ error: validation.errors.join(" / ") }, { status: 422 })
  try {
    const dd = await prisma.directDelivery.create({
      data: {
        customerId: session.user.customerId!,
        customerCode: session.user.companyCode ?? "",
        deliveryCode, companyName,
        departmentName: departmentName ?? null,
        contactPerson: contactPerson ?? null,
        postalCode: postalCode ?? null,
        address1: address1 ?? null,
        phoneNumber: phoneNumber ?? null,
        faxNumber: faxNumber ?? null,
        remarks: remarks ?? null,
      },
    })
    return NextResponse.json({ id: dd.id }, { status: 201 })
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "そのコードは既に登録されています" }, { status: 409 })
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
