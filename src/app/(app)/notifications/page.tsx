// /notifications — お知らせ一覧
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  info:    { label: "お知らせ",   color: "bg-blue-100 text-blue-700" },
  warning: { label: "重要",       color: "bg-yellow-100 text-yellow-700" },
  urgent:  { label: "緊急",       color: "bg-red-100 text-red-600" },
}

export default async function NotificationsPage() {
  const session = await auth()
  const customerId = session!.user.customerId!

  let notifications: any[] = []
  try {
    const now = new Date()
    notifications = await prisma.notification.findMany({
      where: {
        isDeleted: false,
        publishedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      orderBy: [{ publishedAt: "desc" }],
      take: 50,
    })
  } catch { notifications = [] }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-[#1a2744]" />
          <h1 className="font-bold text-gray-800 text-lg">お知らせ一覧</h1>
        </div>
        <Link href="/dashboard" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors">
          メインメニュー
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {notifications.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">現在お知らせはありません</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((n: any) => {
              const t = TYPE_LABEL[n.notifType] ?? { label: n.notifType, color: "bg-gray-100 text-gray-600" }
              return (
                <Link key={n.id} href={`/notifications/${n.id}`}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <span className={`mt-0.5 inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${t.color}`}>
                    {t.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{n.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {n.publishedAt ? new Date(n.publishedAt).toLocaleDateString("ja-JP") : "—"}
                    </p>
                  </div>
                  <span className="text-gray-300 text-sm">›</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
