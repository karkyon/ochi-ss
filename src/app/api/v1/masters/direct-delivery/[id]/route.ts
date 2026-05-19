// PATCH / DELETE /api/v1/masters/direct-delivery/[id]
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { validateWithZod, directDeliverySchema } from "@/lib/zod-schemas"

interface Props { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Props) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const { companyName, departmentName, contactPerson, postalCode, address1, phoneNumber, faxNumber, remarks } = body
  if (!companyName) return NextResponse.json({ error: "直送先名は必須です" }, { status: 400 })
  const dd = await prisma.directDelivery.findFirst({ where: { id, customerId: session.user.customerId!, isDeleted: false } })
  if (!dd) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await prisma.directDelivery.update({
    where: { id },
    data: { companyName, departmentName: departmentName ?? null, contactPerson: contactPerson ?? null, postalCode: postalCode ?? null, address1: address1 ?? null, phoneNumber: phoneNumber ?? null, faxNumber: faxNumber ?? null, remarks: remarks ?? null },
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: Props) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const dd = await prisma.directDelivery.findFirst({ where: { id, customerId: session.user.customerId!, isDeleted: false } })
  if (!dd) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await prisma.directDelivery.update({ where: { id }, data: { isDeleted: true } })
  return NextResponse.json({ ok: true })
}
