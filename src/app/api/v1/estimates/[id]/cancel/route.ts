// POST /api/v1/estimates/[id]/cancel — 見積キャンセル（論理削除）
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const estimate = await prisma.estimateHeader.findFirst({
    where: { id, customerId: session.user.customerId!, isDeleted: false },
  })
  if (!estimate) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (estimate.estimateStatus === "ordered") {
    return NextResponse.json({ error: "注文済みの見積はキャンセルできません" }, { status: 422 })
  }

  await prisma.estimateHeader.update({
    where: { id },
    data: { estimateStatus: "cancelled", isDeleted: true },
  })
  return NextResponse.json({ cancelled: true, id })
}
