import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

// メニューカード定義
const MENU_CARDS = [
  {
    id: "estimate-new",
    icon: "📋",
    title: "お見積り・ご注文",
    description: "新規見積の作成・注文",
    href: "/estimates/new",
    color: "blue",
  },
  {
    id: "estimate-list",
    icon: "📂",
    title: "お見積り履歴",
    description: "過去の見積を検索・確認",
    href: "/estimates",
    color: "green",
  },
  {
    id: "order-list",
    icon: "📦",
    title: "ご注文履歴",
    description: "注文の確認・詳細照会",
    href: "/orders",
    color: "amber",
  },
  {
    id: "delivery",
    icon: "🏭",
    title: "納入先管理",
    description: "直送先の登録・編集",
    href: "/masters/direct-delivery",
    color: "purple",
  },
]

const COLOR_MAP: Record<string, string> = {
  blue:   "bg-blue-50 border-blue-200 hover:bg-blue-100 hover:border-blue-300 hover:shadow-blue-100",
  green:  "bg-emerald-50 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 hover:shadow-emerald-100",
  amber:  "bg-amber-50 border-amber-200 hover:bg-amber-100 hover:border-amber-300 hover:shadow-amber-100",
  purple: "bg-violet-50 border-violet-200 hover:bg-violet-100 hover:border-violet-300 hover:shadow-violet-100",
}

const ICON_BG_MAP: Record<string, string> = {
  blue:   "bg-blue-100",
  green:  "bg-emerald-100",
  amber:  "bg-amber-100",
  purple: "bg-violet-100",
}

export default async function DashboardPage() {
  const session = await auth()

  // 未読お知らせ取得（最大10件）
  let notifications: Array<{
    id: string
    subject: string
    notifyType: string
    priority: number
    publishedAt: Date | null
    isRead: boolean
  }> = []

  try {
    // NOTE: notifications テーブルは未実装のため、空配列で初期化
    // STEP 11 以降で実装予定
    notifications = []
  } catch {
    notifications = []
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">

      {/* ユーザー情報パネル */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 mb-6">
        <p className="text-xs text-gray-500 mb-0.5">ログインユーザー</p>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-bold text-gray-800 text-sm">
            {session?.user?.customerName ?? ""}
          </span>
          <span className="text-gray-400 text-xs">/</span>
          <span className="text-gray-700 text-sm">
            {session?.user?.chargeName ?? session?.user?.userName ?? ""}
          </span>
        </div>
        {session?.user?.companyCode && (
          <p className="text-xs text-gray-400 mt-0.5">
            得意先コード：{session.user.companyCode}
          </p>
        )}
      </div>

      {/* メインメニュー */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 rounded-full bg-[#1a2744]" />
          <h2 className="font-bold text-gray-800">メインメニュー</h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {MENU_CARDS.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              className={`
                group flex flex-col items-start p-5 rounded-xl border-2
                shadow-sm hover:shadow-md transition-all duration-200
                ${COLOR_MAP[card.color]}
              `}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl mb-3 ${ICON_BG_MAP[card.color]}`}>
                {card.icon}
              </div>
              <p className="font-bold text-gray-800 text-sm leading-snug mb-1">
                {card.title}
              </p>
              <p className="text-xs text-gray-500 leading-snug">
                {card.description}
              </p>
            </Link>
          ))}
        </div>

        {/* システム管理者専用（Role=5） */}
        {session?.user?.role === 5 && (
          <div className="mt-3">
            <Link
              href="/admin/debug-config"
              className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all text-sm text-gray-500 hover:text-gray-700"
            >
              <span>⚙️</span>
              <span className="font-medium">デバッグ設定管理</span>
              <span className="text-xs text-gray-400 ml-1">（管理者専用）</span>
            </Link>
          </div>
        )}
      </section>

      {/* お知らせパネル */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-5 rounded-full bg-[#1a2744]" />
          <h2 className="font-bold text-gray-800">🔔 お知らせ</h2>
          {unreadCount > 0 && (
            <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              {unreadCount}件の未読
            </span>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {notifications.length === 0 ? (
            <div className="px-5 py-10 text-center text-gray-400 text-sm">
              現在お知らせはありません
            </div>
          ) : (
            <>
              <ul className="divide-y divide-gray-100">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={`/notifications/${n.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                    >
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          n.isRead ? "bg-transparent" : "bg-blue-500"
                        }`}
                      />
                      <span className={`flex-1 text-sm truncate ${n.isRead ? "text-gray-500" : "font-semibold text-gray-800"}`}>
                        {n.subject}
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {n.publishedAt
                          ? new Date(n.publishedAt).toLocaleDateString("ja-JP", {
                              month: "2-digit",
                              day: "2-digit",
                            })
                          : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="border-t border-gray-100 px-5 py-3 text-right">
                <Link
                  href="/notifications"
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                >
                  お知らせ一覧を見る →
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

    </div>
  )
}
