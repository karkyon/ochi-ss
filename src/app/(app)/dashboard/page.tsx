// src/app/(app)/dashboard/page.tsx
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import OchiHeader from "@/components/ui/OchiHeader"
import DraftRestoreBanner from "@/components/ui/DraftRestoreBanner"
import DashboardNotificationsClient from "./DashboardNotificationsClient"

const MENU_CARDS = [
  { id: "est-new",  icon: "📋", title: "お見積り・ご注文", desc: "新規見積の作成・注文",   href: "/estimates/new",           color: "#dbeafe", border: "#93c5fd", text: "#1e40af" },
  { id: "est-list", icon: "📂", title: "お見積り履歴",     desc: "過去の見積を検索・確認", href: "/estimates",               color: "#dcfce7", border: "#86efac", text: "#166534" },
  { id: "ord-list", icon: "📦", title: "ご注文履歴",       desc: "注文の確認・詳細照会",   href: "/orders",                  color: "#fef3c7", border: "#fcd34d", text: "#92400e" },
  { id: "delivery", icon: "🏭", title: "納入先管理",       desc: "直送先の登録・編集",     href: "/masters/direct-delivery", color: "#f3e8ff", border: "#d8b4fe", text: "#6b21a8" },
]

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const userName    = (session.user as any).userName    ?? (session.user as any).chargeName ?? ""
  const companyName = (session.user as any).companyName ?? (session.user as any).customerName ?? ""
  const customerCode = (session.user as any).customerCode ?? (session.user as any).companyCode ?? ""
  const customerId  = (session.user as any).customerId ?? ""
  const role        = (session.user as any).role ?? 0

  let notifications: any[] = []
  let unreadCount = 0
  try {
    const now = new Date()
    const rows = await prisma.notification.findMany({
      where: {
        isDeleted: false,
        publishedAt: { lte: now },
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: now } },
        ],
      },
      orderBy: { publishedAt: "desc" },
      take: 10,
      select: { id: true, title: true, notifType: true, publishedAt: true },
    })
    const reads = customerId
      ? await prisma.notificationRead.findMany({
          where: { customerId, notificationId: { in: rows.map(r => r.id) } },
          select: { notificationId: true },
        })
      : []
    const readSet = new Set(reads.map(r => r.notificationId))
    notifications = rows.map(r => ({
      id: r.id,
      subject: r.title,
      notifyType: r.notifType,
      priority: 0,
      publishedAt: r.publishedAt,
      isRead: readSet.has(r.id),
    }))
    unreadCount = notifications.filter(n => !n.isRead).length
  } catch { /* サイレント */ }

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
      <OchiHeader userName={userName} companyName={companyName} />

      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "16px" }}>

        {/* ユーザー情報 */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px 14px", marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", marginBottom: "2px" }}>ログインユーザー</div>
          <div style={{ fontSize: "13px", fontWeight: 500 }}>{companyName} / {userName}</div>
          <div style={{ fontSize: "10px", color: "#94a3b8" }}>得意先コード：{customerCode}</div>
        </div>

        {/* メインメニュー */}
        <div style={{ fontSize: "13px", fontWeight: 600, borderLeft: "3px solid #1d4ed8", paddingLeft: "8px", marginBottom: "10px" }}>メインメニュー</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
          {MENU_CARDS.map(card => (
            <Link
              key={card.id}
              href={card.href}
              style={{
                display: "flex", gap: "12px", alignItems: "flex-start",
                padding: "14px 16px",
                background: card.color,
                border: "1px solid " + card.border,
                borderRadius: "8px",
                cursor: "pointer",
                textDecoration: "none",
                transition: "box-shadow 0.15s, transform 0.1s",
              }}
            >
              <div style={{ fontSize: "22px", flexShrink: 0 }}>{card.icon}</div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: card.text, marginBottom: "2px" }}>{card.title}</div>
                <div style={{ fontSize: "11px", color: "#64748b" }}>{card.desc}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Admin専用 */}
        {role >= 3 && (
          <div style={{ marginBottom: "14px" }}>
            <Link href="/masters/chamfer-rules" style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "#fff", border: "1px dashed #cbd5e1", borderRadius: "8px", textDecoration: "none", fontSize: "12px", color: "#64748b" }}>
              <span>⚙️</span><span style={{ fontWeight: 500 }}>面取りルール管理</span><span style={{ fontSize: "10px", color: "#94a3b8" }}>（管理者専用）</span>
            </Link>
          </div>
        )}
        {role >= 5 && (
          <div style={{ marginBottom: "14px" }}>
            <Link href="/admin/debug-config" style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "#fffbeb", border: "1px dashed #fcd34d", borderRadius: "8px", textDecoration: "none", fontSize: "12px", color: "#92400e" }}>
              <span>🔧</span><span style={{ fontWeight: 500 }}>デバッグ設定管理</span>
            </Link>
          </div>
        )}

        {/* DraftRestoreBanner */}
        <DraftRestoreBanner />

        {/* お知らせ */}
        <DashboardNotificationsClient notifications={notifications} unreadCount={unreadCount} />
      </div>
    </div>
  )
}
