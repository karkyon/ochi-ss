"use client"
// dashboard お知らせパネル — 通知区分フィルタ + 未読のみチェックボックス
import { useState } from "react"
import Link from "next/link"

type Notif = {
  id: string
  subject: string
  notifyType: string
  priority: number
  publishedAt: Date | null
  isRead: boolean
}

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  info:    { label: "お知らせ", color: "bg-blue-100 text-blue-700" },
  warning: { label: "重要",     color: "bg-amber-100 text-amber-700" },
  urgent:  { label: "緊急",     color: "bg-red-100 text-red-600" },
}

export default function DashboardNotificationsClient({
  notifications,
  unreadCount,
}: {
  notifications: Notif[]
  unreadCount: number
}) {
  const [typeFilter, setTypeFilter]   = useState<string>("")
  const [unreadOnly, setUnreadOnly]   = useState(false)

  const filtered = notifications.filter(n => {
    if (typeFilter && n.notifyType !== typeFilter) return false
    if (unreadOnly && n.isRead) return false
    return true
  })

  return (
    <section>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="w-1 h-5 rounded-full bg-[#1a2744]" />
        <h2 className="font-bold text-gray-800">🔔 お知らせ</h2>
        {unreadCount > 0 && (
          <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
            {unreadCount}件の未読
          </span>
        )}
        {/* フィルタ */}
        <div className="flex gap-2 ml-auto flex-wrap">
          {[
            { value: "", label: "すべて" },
            { value: "info",    label: "お知らせ" },
            { value: "warning", label: "重要" },
            { value: "urgent",  label: "緊急" },
          ].map(({ value, label }) => (
            <button key={value} onClick={() => setTypeFilter(value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                typeFilter === value
                  ? "bg-[#1a2744] text-white border-[#1a2744]"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >{label}</button>
          ))}
          <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)}
              className="w-3.5 h-3.5 rounded" />
            未読のみ
          </label>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            {notifications.length === 0 ? "現在お知らせはありません" : "条件に一致するお知らせはありません"}
          </div>
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {filtered.slice(0, 10).map(n => {
                const t = TYPE_LABEL[n.notifyType]
                return (
                  <li key={n.id}>
                    <Link href={`/notifications/${n.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${n.isRead ? "bg-transparent" : "bg-blue-500"}`} />
                      {t && (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${t.color}`}>
                          {t.label}
                        </span>
                      )}
                      <span className={`flex-1 text-sm truncate ${n.isRead ? "text-gray-500" : "text-gray-800 font-medium"}`}>
                        {n.subject}
                      </span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {n.publishedAt ? new Date(n.publishedAt).toLocaleDateString("ja-JP") : ""}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
              <Link href="/notifications" className="text-xs text-[#1a2744] hover:underline font-medium">
                お知らせ一覧を見る →
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
