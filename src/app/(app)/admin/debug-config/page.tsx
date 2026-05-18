// src/app/(app)/admin/debug-config/page.tsx
// SystemAdmin専用 — デバッグ設定管理
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"

export default async function DebugConfigPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const roleLevel = (session.user as any).role ?? 0
  if (roleLevel < 4) redirect("/access-denied")

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">デバッグ設定管理</h1>
          <p className="text-xs text-gray-500 mt-0.5">SystemAdmin専用 — システムデバッグ設定の確認・変更</p>
        </div>
        <Link href="/dashboard" className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">← ダッシュボード</Link>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-2xl mb-2">🛠️</p>
          <p className="text-amber-800 font-medium">デバッグ設定管理</p>
          <p className="text-amber-600 text-sm mt-1">この機能はv2で実装予定です。</p>
        </div>
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">現在の設定値（読み取り専用）</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              { label: "デバッグモード", value: process.env.NODE_ENV },
              { label: "ログレベル", value: "INFO" },
              { label: "SP実行タイムアウト", value: "120秒" },
              { label: "Pollingインターバル", value: "30秒" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">{label}</span>
                <span className="font-mono text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
