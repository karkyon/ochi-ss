// src/app/api/v1/notifications/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const notification = await prisma.notification.findFirst({
    where: { id, isDeleted: false },
  })
  if (!notification) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(notification)
}
