// POST /api/v1/estimates/[id]/check-deadline
// 納期有効期限チェック: 期限切れ明細IDリストを返す
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
    include: { details: { where: { isDeleted: false } } },
  })
  if (!estimate) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const now = new Date()
  const expired = estimate.details
    .filter(d => d.deliveryDeadline && new Date(d.deliveryDeadline) < now)
    .map(d => ({ id: d.id, rowNo: d.rowNo, deliveryDeadline: d.deliveryDeadline }))

  return NextResponse.json({
    hasExpired: expired.length > 0,
    expiredCount: expired.length,
    expiredDetails: expired,
  })
}
