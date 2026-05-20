// POST /api/v1/orders/[id]/cancel — 注文キャンセル
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface Props { params: Promise<{ id: string }> }

export async function POST(
  _req: NextRequest,
  { params }: Props
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const order = await (prisma as any).order.findFirst({
    where: { id, customerId: session.user.customerId!, isDeleted: false },
  })
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // キャンセル可能ステータス: pending / confirmed のみ
  if (!["pending", "confirmed"].includes(order.orderStatus)) {
    return NextResponse.json(
      { error: `${order.orderStatus} の注文はキャンセルできません（製造中・出荷済・完了・取消）` },
      { status: 422 }
    )
  }

  // トランザクション: 注文キャンセル + 見積ステータスを saved に戻す
  await (prisma as any).$transaction(async (tx: any) => {
    await tx.order.update({
      where: { id },
      data: { orderStatus: "cancelled" },
    })
    await tx.estimateHeader.update({
      where: { id: order.estimateHeaderId },
      data: { estimateStatus: "saved" },
    })
    // ステータス履歴記録
    await tx.orderStatusHistory.create({
      data: {
        orderId:      id,
        fromStatus:   order.orderStatus,
        toStatus:     "cancelled",
        changedBy:    session.user.userId ?? "system",
        changeReason: "顧客によるキャンセル",
      },
    }).catch(() => { /* OrderStatusHistory が存在しない場合はスキップ */ })
  })

  return NextResponse.json({ cancelled: true, id, orderStatus: "cancelled" })
}
