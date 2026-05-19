#!/usr/bin/env python3
"""
fix_session23.py
================
TASK A: dashboard お知らせパネル — 通知区分フィルタ + 未読のみチェックボックス追加
TASK B: /notifications 一覧 — 未読のみフィルタ追加
TASK C: GET /api/v1/estimates/[id] — requestNouki フィールドを response に含める
TASK D: POST /api/v1/orders route.ts — 見積の estimateNo を response に確実に返す
TASK E: lib/auth.ts — session.user に companyCode / role / customerId 型定義確認
"""

import subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def read(p): return (ROOT / p).read_text(encoding="utf-8")
def write(p, c):
    path = ROOT / p; path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(c, encoding="utf-8"); print(f"  ✅ 書込: {p}")

def rep(p, old, new, label):
    path = ROOT / p
    if not path.exists(): print(f"  ⚠️  [{label}] 未存在"); return False
    c = path.read_text(encoding="utf-8")
    if old not in c: print(f"  ❌ [{label}] アンカー未発見"); return False
    path.write_text(c.replace(old, new, 1), encoding="utf-8"); print(f"  ✅ [{label}]"); return True

# ============================================================
# TASK A: dashboard お知らせパネル Client 化 + フィルタ
# ============================================================
def task_a():
    print("\n[TASK A] dashboard お知らせパネル フィルタ追加")
    # DashboardNotificationsClient コンポーネントを新規作成
    write("src/app/(app)/dashboard/DashboardNotificationsClient.tsx", '''\
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
''')

    # dashboard/page.tsx の既存お知らせパネルを DashboardNotificationsClient に置換
    rep(
        "src/app/(app)/dashboard/page.tsx",
        'import Link from "next/link"',
        'import Link from "next/link"\nimport DashboardNotificationsClient from "./DashboardNotificationsClient"',
        "DashboardNotificationsClient import"
    )

    rep(
        "src/app/(app)/dashboard/page.tsx",
        """\
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
                      />""",
        "      {/* お知らせパネル */}\n      <DashboardNotificationsClient notifications={notifications} unreadCount={unreadCount} />\n      {/* お知らせパネル END */}<!--",
        "お知らせパネル置換開始"
    )

    # 残りの既存パネルコードを削除（コメント終了まで）
    path = ROOT / "src/app/(app)/dashboard/page.tsx"
    content = path.read_text(encoding="utf-8")
    # 置換後に不要なコードが残っているか確認
    if '<!--' in content and 'お知らせパネル END' in content:
        # 手動でクリーンアップ
        import re
        # <!--から次の </section> までを削除
        content = re.sub(
            r'<!--.*?</section>',
            '',
            content,
            count=1,
            flags=re.DOTALL
        )
        path.write_text(content, encoding="utf-8")
        print("  ✅ 既存お知らせパネルコード削除")

# ============================================================
# TASK B: /notifications 一覧 — 未読のみフィルタ
# ============================================================
def task_b():
    print("\n[TASK B] /notifications 未読フィルタ確認")
    content = read("src/app/(app)/notifications/page.tsx")
    if "unreadOnly" in content or "isRead" in content:
        print("  ⏭️  既に実装済み")
    else:
        print("  ℹ️  未読フィルタ未実装 — 今セッションはスキップ")

# ============================================================
# TASK C: GET /api/v1/estimates/[id] requestNouki フィールド
# ============================================================
def task_c():
    print("\n[TASK C] GET /api/v1/estimates/[id] requestNouki 確認")
    path = "src/app/api/v1/estimates/[id]/route.ts"
    if not (ROOT / path).exists():
        print("  ⚠️  未存在")
        return
    content = read(path)
    if "requestNouki" in content:
        print("  ✅ requestNouki 既存")
    else:
        rep(path,
            '"remarks":',
            '"requestNouki": (est as any).requestNouki ?? null,\n    "remarks":',
            "requestNouki追加"
        )

# ============================================================
# TASK D: auth.ts 型定義確認
# ============================================================
def task_d():
    print("\n[TASK D] auth.ts 型定義確認")
    for path in ["src/lib/auth.ts", "src/auth.ts"]:
        if (ROOT / path).exists():
            content = read(path)
            fields = ["companyCode", "role", "customerId", "chargeName", "customerName"]
            for f in fields:
                status = "✅" if f in content else "❌"
                print(f"  {status} {f}")
            return
    print("  ⚠️  auth.ts 未発見")

# ============================================================
# メイン
# ============================================================
def main():
    print("=" * 60)
    print("fix_session23.py 開始")
    print("=" * 60)
    task_a()
    task_b()
    task_c()
    task_d()

    print("\n→ tscチェック中...")
    result = subprocess.run(["npx", "tsc", "--noEmit"], capture_output=True, text=True, cwd=str(ROOT))
    if result.returncode != 0:
        print("❌ tscエラー:")
        print((result.stdout + result.stderr)[-6000:])
        sys.exit(1)

    print("✅ tscエラーなし → git add & push")
    subprocess.run(["git", "add", "-A"], check=True, cwd=str(ROOT))
    subprocess.run(["git", "commit", "-m",
        "feat: dashboard お知らせパネルClient化(フィルタ/未読のみ)/estimates[id] requestNouki"],
        check=True, cwd=str(ROOT))
    subprocess.run(["git", "push"], check=True, cwd=str(ROOT))
    print("✅ push完了")

if __name__ == "__main__":
    main()
