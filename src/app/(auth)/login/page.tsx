"use client"
// =============================================================
//  src/app/(auth)/login/page.tsx  （修正版 v2）
//
//  修正: useRef<HTMLInputElement>(null) の型を
//        handleKeyPress 関数のパラメータ型と合わせるために
//        RefObject<HTMLInputElement | null> → 直接 .current を参照
// =============================================================

import { useState, useEffect, useRef, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"

const ERROR_MESSAGES: Record<string, string> = {
  "-1": "ユーザーIDまたはパスワードが正しくありません。",
  "-2": "このアカウントは無効またはロックされています。管理者にお問い合わせください。",
  "-3": "この企業はログインが許可されていません。管理者にお問い合わせください。",
  "-4": "企業コードが正しくありません。",
  "-99": "システムエラーが発生しました。しばらく待ってから再試行してください。",
  CredentialsSignin: "ユーザーIDまたはパスワードが正しくありません。",
  default: "ログインに失敗しました。入力内容を確認してください。",
}

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [companyCode, setCompanyCode] = useState("")
  const [userId, setUserId] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPw, setShowPw]     = useState(false)

  const isTimeout = searchParams.get("timeout") === "1"
  const isLoggedOut = searchParams.get("logout") === "1"
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard"

  // ★ 修正: useRef<HTMLInputElement | null>(null) にして
  //    handleKeyPress 内で .current を直接参照
  const companyCodeRef = useRef<HTMLInputElement | null>(null)
  const userIdRef = useRef<HTMLInputElement | null>(null)
  const passwordRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    companyCodeRef.current?.focus()
  }, [])

  const handleCompanyCodeBlur = () => {
    const cleaned = companyCode.replace(/\D/g, "").padStart(5, "0").slice(-5)
    setCompanyCode(cleaned)
  }

  // ★ 修正: RefObject を受け取るのではなく、ref.current を直接操作
  const handleKeyDown =
    (nextRef: React.RefObject<HTMLInputElement | null>) =>
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        nextRef.current?.focus()
      }
    }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!/^\d{5}$/.test(companyCode)) {
      setError("企業コードは5桁の数字で入力してください。")
      return
    }
    if (!userId.trim()) {
      setError("ユーザーIDを入力してください。")
      return
    }
    if (!password) {
      setError("パスワードを入力してください。")
      return
    }

    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        companyCode,
        userId: userId.trim(),
        password,
        redirect: false,
      })

      if (result?.error) {
        const code = result.error
        setError(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.default)
        setIsLoading(false)
        return
      }

      router.push(callbackUrl)
      router.refresh()
    } catch {
      setError(ERROR_MESSAGES.default)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto mb-3"
          >
            <rect width="48" height="48" rx="10" fill="#1A4080" />
            <path d="M12 24 L24 12 L36 24 L24 36 Z" stroke="white" strokeWidth="2.5" fill="none" />
            <circle cx="24" cy="24" r="4" fill="white" />
          </svg>
          <h1 className="text-[22px] font-bold text-[#1A2035] tracking-wide">越智製作所</h1>
          <p className="text-[13px] text-[#6B7A99] mt-1 tracking-widest">Web オーダーシステム</p>
        </div>

        {/* ログインカード */}
        <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] p-8">
          {isTimeout && (
            <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-[13px] text-amber-700 flex items-start gap-2">
              <span className="mt-0.5">⚠</span>
              <span>セッションがタイムアウトしました。再度ログインしてください。</span>
            </div>
          )}
          {isLoggedOut && (
            <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-[13px] text-blue-700 flex items-start gap-2">
              <span className="mt-0.5">✓</span>
              <span>ログアウトしました。</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* 企業コード */}
            <div className="mb-4">
              <label htmlFor="companyCode" className="block text-[13px] font-semibold text-[#374151] mb-1.5">
                企業コード <span className="text-red-500">*</span>
              </label>
              <input
                id="companyCode"
                ref={companyCodeRef}
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value.replace(/\D/g, ""))}
                onBlur={handleCompanyCodeBlur}
                onKeyDown={handleKeyDown(userIdRef)}
                placeholder="12345"
                autoComplete="organization"
                className="w-full h-11 px-4 text-[15px] border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A4080]/30 focus:border-[#1A4080] transition-colors placeholder:text-[#C4C9D4] disabled:bg-gray-50"
                disabled={isLoading}
              />
              <p className="text-[11px] text-[#9CA3AF] mt-1">例: 00010（5桁の数字）</p>
            </div>

            {/* ユーザーID */}
            <div className="mb-4">
              <label htmlFor="userId" className="block text-[13px] font-semibold text-[#374151] mb-1.5">
                ユーザーID <span className="text-red-500">*</span>
              </label>
              <input
                id="userId"
                ref={userIdRef}
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                onKeyDown={handleKeyDown(passwordRef)}
                placeholder="ユーザーIDを入力"
                autoComplete="username"
                maxLength={50}
                className="w-full h-11 px-4 text-[15px] border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A4080]/30 focus:border-[#1A4080] transition-colors placeholder:text-[#C4C9D4] disabled:bg-gray-50"
                disabled={isLoading}
              />
            </div>

            {/* パスワード */}
            <div className="mb-5">
              <label htmlFor="password" className="block text-[13px] font-semibold text-[#374151] mb-1.5">
                パスワード <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  ref={passwordRef}
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="パスワードを入力"
                  autoComplete="current-password"
                  maxLength={50}
                  className="w-full h-11 px-4 pr-11 text-[15px] border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A4080]/30 focus:border-[#1A4080] transition-colors placeholder:text-[#C4C9D4] disabled:bg-gray-50"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm select-none"
                  tabIndex={-1}
                  aria-label={showPw ? "パスワードを隠す" : "パスワードを表示"}
                >
                  {showPw ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* ログイン状態保持 */}
            <div className="mb-5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#1A4080] focus:ring-[#1A4080]/30 cursor-pointer"
                  disabled={isLoading}
                />
                <span className="text-[13px] text-[#6B7280]">ログイン状態を保持する（30日間）</span>
              </label>
            </div>

            {/* エラーメッセージ */}
            {error && (
              <div role="alert" className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700 flex items-start gap-2">
                <span className="mt-0.5 shrink-0">✕</span>
                <span>{error}</span>
              </div>
            )}

            {/* ログインボタン */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-[#1A4080] hover:bg-[#143266] active:bg-[#0F2550] text-white text-[15px] font-semibold rounded-lg transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  ログイン中...
                </>
              ) : "ログイン"}
            </button>
          </form>

          <p className="mt-5 text-center text-[11px] text-[#9CA3AF] leading-relaxed">
            企業コード・ユーザーID・パスワードをすべて入力してください。
            <br />
            ログインに関するお問い合わせは管理者までご連絡ください。
          </p>
        </div>

        <p className="mt-6 text-center text-[11px] text-[#9CA3AF]">
          © {new Date().getFullYear()} 越智製作所. All rights reserved.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}
