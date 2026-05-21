"use client"
import { useState } from "react"
import Link from "next/link"

interface Notif { id: string; subject: string; notifyType: string; priority: number; publishedAt: string | null; isRead: boolean }
const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  system:    { label: "システム", cls: "badge-blue" },
  info:      { label: "お知らせ", cls: "badge-blue" },
  contact:   { label: "連絡",     cls: "badge-green" },
  auto:      { label: "自動通知", cls: "badge-gray" },
  important: { label: "重要",     cls: "badge-amber" },
  urgent:    { label: "緊急",     cls: "badge-red" },
  other:     { label: "その他",   cls: "badge-gray" },
}

export default function NotificationsClient({ notifications }: { notifications: Notif[] }) {
  const [filter, setFilter] = useState("all")
  const [unreadOnly, setUnreadOnly] = useState(false)
  const filtered = notifications.filter(n => {
    if (unreadOnly && n.isRead) return false
    if (filter !== "all" && n.notifyType !== filter) return false
    return true
  })
  const th: React.CSSProperties = { background: "linear-gradient(to bottom,#f1f5f9,#e2e8f0)", border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "left", fontWeight: 600, fontSize: "10px", color: "#334155" }
  const td: React.CSSProperties = { border: "1px solid #e2e8f0", padding: "5px 8px", fontSize: "11px", verticalAlign: "middle" }

  return (
    <>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px", alignItems: "center", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "8px 12px" }}>
        {[["all","すべて"],["system","システム"],["contact","連絡"],["auto","自動通知"],["important","重要"],["urgent","緊急"],["other","その他"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            style={{ padding: "3px 10px", borderRadius: "10px", fontSize: "11px", cursor: "pointer", border: filter === k ? "none" : "1px solid #e2e8f0", background: filter === k ? "#1d4ed8" : "#fff", color: filter === k ? "#fff" : "#64748b", fontWeight: filter === k ? 600 : 400 }}
          >{l}</button>
        ))}
        <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#64748b", cursor: "pointer" }}>
          <input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)} />未読のみ
        </label>
      </div>
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "6px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: "120px" }}>日時</th>
              <th style={{ ...th, width: "70px" }}>種別</th>
              <th style={th}>内容</th>
              <th style={{ ...th, width: "55px", textAlign: "center" }}>既読</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={4} style={{ ...td, textAlign: "center", padding: "24px", color: "#94a3b8" }}>お知らせはありません</td></tr>
            ) : filtered.map(n => {
              const badge = TYPE_BADGE[n.notifyType] ?? TYPE_BADGE.other
              const dateStr = n.publishedAt ? new Date(n.publishedAt).toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"
              return (
                <tr key={n.id} style={{ cursor: "pointer" }}
                  onMouseEnter={e => { Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(c => c.style.background = "#eff6ff") }}
                  onMouseLeave={e => { Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(c => c.style.background = "") }}
                >
                  <td style={td}>
                    {!n.isRead && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#1d4ed8", display: "inline-block", marginRight: "6px", verticalAlign: "middle" }} />}
                    <span style={{ color: "#94a3b8" }}>{dateStr}</span>
                  </td>
                  <td style={td}><span className={badge.cls}>{badge.label}</span></td>
                  <td style={{ ...td, fontWeight: n.isRead ? 400 : 600 }}>
                    <Link href={`/notifications/${n.id}`} style={{ color: "inherit", textDecoration: "none" }}>{n.subject}</Link>
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <span className={n.isRead ? "badge-gray" : "badge-blue"}>{n.isRead ? "既読" : "未読"}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
