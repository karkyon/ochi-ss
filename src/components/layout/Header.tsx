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
