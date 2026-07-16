// POST /api/v1/notifications/[id]/reply — お知らせ返信
import { NextRequest, NextResponse } from "next/server"
import { getTenantCtx } from "@/lib/tenant-guard"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await getTenantCtx()
  if (error) return error

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

  // ★重大バグ修正(2026/07/15): 返信通知を targetCustomers: null(=全顧客への
  // 公開通知)として作成していたため、ある得意先が送った返信内容が
  // 一覧APIを通じて他の全ての得意先にも見えてしまうマルチテナント漏洩に
  // なっていた。返信は本来、送信した得意先と越智製作所内部だけが見るべき
  // ものなので、targetCustomersを送信元の得意先IDに限定する。
  const reply = await prisma.notification.create({
    data: {
      title:    `返信: ${parent.title}`,
      content:  body.body,
      notifType: "info",
      targetCustomers: [ctx.customerId],
      publishedAt: new Date(),
      createdBy: ctx.userName || ctx.customerId,
    },
  })

  return NextResponse.json({ success: true, id: reply.id }, { status: 201 })
}
