import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import NotificationsClient from "./NotificationsClient"

export default async function NotificationsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const customerId = (session.user as any).customerId ?? ""
  const now = new Date()
  const rows = await prisma.notification.findMany({
    where: { isDeleted: false, isActive: true, OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] },
    orderBy: [{ priority: "desc" }, { publishedAt: "desc" }],
    take: 100,
    select: { id: true, subject: true, notifyType: true, priority: true, publishedAt: true, body: true },
  })
  const reads = await prisma.notificationRead.findMany({
    where: { customerId, notificationId: { in: rows.map(r => r.id) } },
    select: { notificationId: true },
  })
  const readSet = new Set(reads.map(r => r.notificationId))
  const notifications = rows.map(r => ({
    id: r.id, subject: r.subject ?? "（タイトルなし）",
    notifyType: r.notifyType ?? "info", priority: r.priority,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    isRead: readSet.has(r.id),
  }))
  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <div style={{ fontSize: "14px", fontWeight: 600, borderLeft: "3px solid #1d4ed8", paddingLeft: "8px" }}>お知らせ一覧</div>
        <Link href="/dashboard" className="btn-ochi btn-outline" style={{ fontSize: "11px" }}>← メインメニュー</Link>
      </div>
      <NotificationsClient notifications={notifications} />
    </div>
  )
}
