import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

const STATUS_LABEL: Record<string, string> = {
  draft: "下書き", saved: "保存済", ordered: "注文済", cancelled: "取消",
}

export default async function AdminDashboardPage() {
  const session = await auth()
  const customerId = (session!.user as any).customerId as string

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [estimateCountMonth, orderCountMonth, pendingOrders, estimateAmountAgg, recentEstimates] = await Promise.all([
    prisma.estimateHeader.count({ where: { customerId, isDeleted: false, estimateDate: { gte: monthStart } } }),
    prisma.order.count({ where: { customerId, isDeleted: false, orderDate: { gte: monthStart } } }),
    prisma.order.count({ where: { customerId, isDeleted: false, orderStatus: { in: ["pending", "confirmed"] } } }),
    prisma.estimateDetail.aggregate({
      _sum: { totalPrice: true },
      where: { isDeleted: false, estimateHeader: { customerId, isDeleted: false, estimateDate: { gte: monthStart } } },
    }),
    prisma.estimateHeader.findMany({
      where: { customerId, isDeleted: false },
      orderBy: { estimateDate: "desc" },
      take: 5,
      select: { id: true, estimateNo: true, estimateDate: true, destinationName: true, estimateStatus: true },
    }),
  ])

  const cards = [
    { label: "今月の見積件数", value: String(estimateCountMonth), icon: "📋", color: "#1d4ed8", bg: "#dbeafe" },
    { label: "今月の注文件数", value: String(orderCountMonth), icon: "📦", color: "#166534", bg: "#dcfce7" },
    { label: "処理中の注文", value: String(pendingOrders), icon: "⏳", color: "#92400e", bg: "#fef3c7" },
    { label: "今月の見積金額", value: `¥${Number(estimateAmountAgg._sum.totalPrice ?? 0).toLocaleString()}`, icon: "💰", color: "#6b21a8", bg: "#f3e8ff" },
  ]

  const quickActions = [
    { href: "/admin/company", icon: "🏢", label: "自社情報設定", desc: "見積書PDFの会社情報を編集" },
    { href: "/estimates/new", icon: "📋", label: "新規見積作成", desc: "見積を新規作成" },
    { href: "/orders", icon: "📦", label: "注文一覧", desc: "注文状況を確認" },
    { href: "/masters/direct-delivery", icon: "🚚", label: "直送先管理", desc: "直送先の登録・編集" },
  ]

  return (
    <div>
      <div style={{ marginBottom: "18px" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>ダッシュボード</h1>
        <p style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>システムの概要と最近の活動を確認できます</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "20px" }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>{c.icon}</div>
            <div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>{c.label}</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: c.color }}>{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "16px" }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>最近の見積</div>
            <Link href="/estimates" style={{ fontSize: "11px", color: "#1d4ed8" }}>すべて表示</Link>
          </div>
          {recentEstimates.length === 0 ? (
            <div style={{ fontSize: "12px", color: "#94a3b8", padding: "16px", textAlign: "center" }}>見積データがありません</div>
          ) : (
            <div>
              {recentEstimates.map(e => (
                <Link key={e.id} href={`/estimates/${e.id}/edit`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 4px", borderBottom: "1px solid #f1f5f9", textDecoration: "none" }}>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>{e.estimateNo ?? "（未採番）"}</div>
                    <div style={{ fontSize: "10px", color: "#94a3b8" }}>{e.destinationName ?? "—"} ・ {e.estimateDate ? new Date(e.estimateDate).toLocaleDateString("ja-JP") : "—"}</div>
                  </div>
                  <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "9999px", background: "#f1f5f9", color: "#475569" }}>{STATUS_LABEL[e.estimateStatus] ?? e.estimateStatus}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", marginBottom: "10px" }}>クイックアクション</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {quickActions.map(a => (
              <Link key={a.href} href={a.href} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px", textDecoration: "none", display: "block" }}>
                <div style={{ fontSize: "18px", marginBottom: "4px" }}>{a.icon}</div>
                <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#1e293b" }}>{a.label}</div>
                <div style={{ fontSize: "9.5px", color: "#94a3b8", marginTop: "1px" }}>{a.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
