// POST /api/v1/notifications/[id]/reply — お知らせ返信
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body.body?.trim()) {
    return NextResponse.json({ error: "返信内容は必須です" }, { status: 400 })
  }

  // 親通知確認
  const parent = await prisma.notification.findFirst({
    where: { id, isDeleted: false },
  })
  if (!parent) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // 返信通知作成（越智製作所へ送信される想定）
  const reply = await prisma.notification.create({
    data: {
      title:    `返信: ${parent.title}`,
      content:  body.body,
      notifType: "info",
      targetCustomers: Prisma.JsonNull,
      publishedAt: new Date(),
      createdBy: session.user.userId ?? session.user.customerId!,
    },
  })

  return NextResponse.json({ success: true, id: reply.id }, { status: 201 })
}
