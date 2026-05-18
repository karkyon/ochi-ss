// PATCH /api/v1/notifications/[id]/read — 既読マーク（スタブ）
// NotificationRead テーブルが未実装のため 200 返却のみ
// v2 で notification_reads テーブル追加予定
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  // TODO: notification_reads テーブル実装後に既読記録を追加
  return NextResponse.json({ id, read: true })
}
