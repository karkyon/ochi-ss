// /access-denied — アクセス拒否ページ
import Link from "next/link"

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">🚫</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">アクセスが拒否されました</h1>
        <p className="text-gray-500 text-sm mb-8">
          このページにアクセスする権限がありません。<br />
          必要な権限については管理者にお問い合わせください。
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-6 py-2.5 bg-[#1a2744] text-white text-sm rounded-lg hover:bg-[#1a3a6e] transition-colors font-medium"
          >
            メインメニューへ
          </Link>
          <Link
            href="/login"
            className="px-6 py-2.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            ログイン画面へ
          </Link>
        </div>
        <p className="mt-8 text-xs text-gray-400">
          お問い合わせ：weborder@ochi-ss.co.jp
        </p>
      </div>
    </div>
  )
}
