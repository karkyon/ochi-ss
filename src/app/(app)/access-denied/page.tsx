// /access-denied — アクセス拒否（403）ページ
import { auth } from "@/lib/auth"
import Link from "next/link"
import AccessDeniedClient from "./AccessDeniedClient"

export default async function AccessDeniedPage() {
  const session = await auth()
  const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🚫</span>
          </div>
          <div className="inline-block px-3 py-1 bg-red-100 text-red-700 text-xs font-mono rounded-full mb-4">
            HTTP 403 Forbidden
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">アクセスが拒否されました</h1>
          <p className="text-gray-500 text-sm mb-6">
            このページにアクセスする権限がありません。<br />
            必要な権限については管理者にお問い合わせください。
          </p>

          {/* エラー詳細 */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-6 text-left text-xs text-gray-600 space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400">発生日時</span>
              <span className="font-mono">{now}</span>
            </div>
            {session?.user && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-400">ユーザー</span>
                  <span className="font-mono">{(session.user as any).userId ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">企業コード</span>
                  <span className="font-mono">{(session.user as any).companyCode ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">権限レベル</span>
                  <span className="font-mono">Role = {(session.user as any).role ?? 0}</span>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <AccessDeniedClient />
            <Link href="/dashboard"
              className="px-6 py-2.5 bg-[#1a2744] text-white text-sm rounded-lg hover:bg-[#1a3a6e] transition-colors font-medium">
              メインメニューへ
            </Link>
            <Link href="/login"
              className="px-6 py-2.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
              ログイン画面へ
            </Link>
          </div>

          <p className="mt-6 text-xs text-gray-400">
            お問い合わせ：weborder@ochi-ss.co.jp　TEL：072-882-5524
          </p>
        </div>
      </div>
    </div>
  )
}
