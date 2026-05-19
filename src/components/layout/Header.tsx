"use client"

import { useSession, signOut } from "next-auth/react"
import { useState, useEffect } from "react"
import Link from "next/link"

interface HeaderProps {
  notificationCount?: number
}

export default function Header({ notificationCount = 0 }: HeaderProps) {
  const { data: session } = useSession()
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [timeoutWarning, setTimeoutWarning] = useState(false)

  // セッションタイムアウト警告（残り25分で表示）
  useEffect(() => {
    const timeoutMin = (session?.user as any)?.sessionTimeoutMin ?? 140
    const warnMs = (timeoutMin - 25) * 60 * 1000
    if (warnMs <= 0) return
    const timer = setTimeout(() => setTimeoutWarning(true), warnMs)
    return () => clearTimeout(timer)
  }, [session])

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login?logout=1" })
  }

  return (
    <>
      <header className="sticky top-0 z-50 h-14 bg-[#1a2744] border-b border-[#2d4a7a] shadow-lg flex items-center px-4 gap-3">
        {/* ロゴ・タイトル */}
        <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
          <span className="text-white font-bold text-sm whitespace-nowrap tracking-wide">
            越智製作所
          </span>
          <span className="hidden sm:inline text-[#93c5fd] text-xs font-medium whitespace-nowrap">
            Webオーダーシステム
          </span>
        </Link>

        {/* スペーサー */}
        <div className="flex-1" />

        {/* タイムアウト警告 */}
        {timeoutWarning && (
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[10px]">
            <span>⚠️</span>
            <span>セッション期限まもなく切れます</span>
          </div>
        )}

        {/* 通知ベル */}
        <Link
          href="/notifications"
          className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/10 transition-colors"
          title="お知らせ"
        >
          <span className="text-lg">🔔</span>
          {notificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
              {notificationCount > 99 ? "99+" : notificationCount}
            </span>
          )}
        </Link>

        {/* ハンバーガーボタン（sm未満で表示） */}
        <button
          className="sm:hidden flex flex-col gap-1 p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="メニュー"
        >
          <span className={`block w-5 h-0.5 bg-current transition-transform ${menuOpen ? "rotate-45 translate-y-1.5" : ""}`} />
          <span className={`block w-5 h-0.5 bg-current transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
          <span className={`block w-5 h-0.5 bg-current transition-transform ${menuOpen ? "-rotate-45 -translate-y-1.5" : ""}`} />
        </button>

        {/* ユーザー情報 + ログアウト */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/20">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-white text-xs font-medium leading-tight">
              {session?.user?.chargeName ?? session?.user?.userName ?? ""}
            </span>
            <span className="text-[#93c5fd] text-[10px] leading-tight">
              {session?.user?.customerName ?? ""}
            </span>
          </div>
          <button
            onClick={() => setShowLogoutDialog(true)}
            className="px-3 py-1.5 rounded text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transition-all whitespace-nowrap"
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* モバイルドロワーメニュー */}
      {menuOpen && (
        <div className="sm:hidden fixed inset-0 z-[90] flex flex-col" onClick={() => setMenuOpen(false)}>
          <div className="h-14" />
          <div className="bg-[#1a2744]/95 backdrop-blur flex-1 p-4 space-y-2" onClick={e => e.stopPropagation()}>
            <div className="pb-3 mb-3 border-b border-white/20">
              <p className="text-white text-sm font-medium">{session?.user?.chargeName ?? ""}</p>
              <p className="text-[#93c5fd] text-xs">{session?.user?.customerName ?? ""}</p>
            </div>
            {[
              { href: "/dashboard",    label: "🏠 メインメニュー" },
              { href: "/estimates",    label: "📋 見積一覧" },
              { href: "/estimates/new",label: "✏️ 新規見積" },
              { href: "/orders",       label: "📦 注文履歴" },
              { href: "/notifications",label: `🔔 お知らせ${notificationCount > 0 ? ` (${notificationCount})` : ""}` },
              { href: "/masters/direct-delivery", label: "🏭 納入先管理" },
            ].map(({ href, label }) => (
              <Link key={href} href={href} onClick={() => setMenuOpen(false)}
                className="block px-4 py-2.5 rounded-lg text-white text-sm hover:bg-white/10 transition-colors">
                {label}
              </Link>
            ))}
            <div className="pt-3 mt-3 border-t border-white/20">
              <button onClick={() => { setMenuOpen(false); setShowLogoutDialog(true) }}
                className="w-full px-4 py-2.5 rounded-lg text-red-300 text-sm text-left hover:bg-white/10 transition-colors">
                🚪 ログアウト
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ログアウト確認ダイアログ */}
      {showLogoutDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-80 mx-4">
            <div className="text-center mb-4">
              <span className="text-3xl">💭</span>
              <h3 className="text-base font-bold text-gray-800 mt-2">
                ログアウトしますか？
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                未保存のデータがある場合は失われます。
              </p>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowLogoutDialog(false)}
                className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2 rounded-lg bg-red-600 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
