// src/app/api/v1/masters/chamfer-rules/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function isAdmin(session: any) { return (session?.user?.roleLevel ?? 0) >= 3 }

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const updated = await prisma.chamferRule.update({
    where: { id },
    data: {
      ...(body.materialCode       != null && { materialCode: body.materialCode }),
      ...(body.processingSpecCode != null && { processingSpecCode: Number(body.processingSpecCode) }),
      ...(body.sizeAFrom          != null && { sizeAFrom: Number(body.sizeAFrom) }),
      ...(body.sizeATo            != null && { sizeATo:   Number(body.sizeATo) }),
      ...(body.sizeBFrom          != null && { sizeBFrom: Number(body.sizeBFrom) }),
      ...(body.sizeBTo            != null && { sizeBTo:   Number(body.sizeBTo) }),
      ...(body.limitChamfer4      != null && { limitChamfer4: Number(body.limitChamfer4) }),
      ...(body.limitChamfer8      != null && { limitChamfer8: Number(body.limitChamfer8) }),
      ...(body.maxChamfer4        != null && { maxChamfer4: Number(body.maxChamfer4) }),
      ...(body.maxChamfer8        != null && { maxChamfer8: Number(body.maxChamfer8) }),
      ...(body.priority           != null && { priority: Number(body.priority) }),
    }
  })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  await prisma.chamferRule.update({ where: { id }, data: { isDeleted: true } })
  return NextResponse.json({ deleted: true })
}
