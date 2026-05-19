"use client"
export default function AccessDeniedClient() {
  return (
    <button
      onClick={() => window.history.back()}
      className="px-6 py-2.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
    >
      ← 前のページへ戻る
    </button>
  )
}
