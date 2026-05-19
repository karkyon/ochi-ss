#!/usr/bin/env python3
"""
fix_session24.py
================
TASK A: /notifications 一覧 — 未読のみフィルタ実装（NotificationRead テーブル連携）
TASK B: /estimates/[id]/edit page.tsx — copyFrom クエリ対応確認
TASK C: /estimates/new EstimateNewClient — 保存後 estimateNo を saveMessage に表示
TASK D: POST /api/v1/orders — 二重注文防止チェック（既に ordered の場合 409）
TASK E: POST /api/v1/estimates/[id]/cancel — 見積キャンセルAPI実装
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
# TASK A: /notifications 未読フィルタ実装
# ============================================================
def task_a():
    print("\n[TASK A] /notifications 未読フィルタ実装")
    write("src/app/(app)/notifications/page.tsx", '''\
// /notifications — お知らせ一覧（フィルタ+ページネーション+未読フィルタ）
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  info:    { label: "お知らせ", color: "bg-blue-100 text-blue-700" },
  warning: { label: "重要",     color: "bg-amber-100 text-amber-700" },
  urgent:  { label: "緊急",     color: "bg-red-100 text-red-600" },
}
const PER_PAGE = 20

interface Props {
  searchParams: Promise<{ type?: string; page?: string; readFilter?: string }>
}

export default async function NotificationsPage({ searchParams }: Props) {
  const session = await auth()
  const { type, page: pageStr, readFilter } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? "1", 10))
  const customerId = session?.user?.customerId!

  const now = new Date()
  const where: any = {
    isDeleted: false,
    publishedAt: { lte: now },
    OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    ...(type ? { notifType: type } : {}),
  }

  // 既読IDを取得
  let readIds = new Set<string>()
  try {
    const reads = await (prisma as any).notificationRead.findMany({
      where: { customerId },
      select: { notificationId: true },
    })
    readIds = new Set(reads.map((r: any) => r.notificationId))
  } catch { /* silent */ }

  const [total, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
  ])

  // 未読フィルタ適用
  const notificationsWithRead = notifications.map((n: any) => ({
    ...n,
    isRead: readIds.has(n.id),
  }))
  const filtered = readFilter === "unread"
    ? notificationsWithRead.filter((n: any) => !n.isRead)
    : readFilter === "read"
    ? notificationsWithRead.filter((n: any) => n.isRead)
    : notificationsWithRead

  const totalPages = Math.ceil(total / PER_PAGE)

  const buildUrl = (p: number, t?: string, rf?: string) => {
    const params = new URLSearchParams()
    if (t)  params.set("type", t)
    if (rf) params.set("readFilter", rf)
    if (p > 1) params.set("page", String(p))
    return `/notifications${params.toString() ? "?" + params.toString() : ""}`
  }

  const unreadCount = notificationsWithRead.filter((n: any) => !n.isRead).length

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-[#1a2744]" />
          <h1 className="font-bold text-gray-800 text-lg">お知らせ一覧</h1>
          <span className="text-xs text-gray-400 ml-1">{total}件</span>
          {unreadCount > 0 && (
            <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              {unreadCount}件の未読
            </span>
          )}
        </div>
        <Link href="/dashboard" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50">
          メインメニュー
        </Link>
      </div>

      {/* フィルタ行 */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {/* 通知区分 */}
        {[
          { value: "", label: "すべて" },
          { value: "info",    label: "お知らせ" },
          { value: "warning", label: "重要" },
          { value: "urgent",  label: "緊急" },
        ].map(({ value, label }) => (
          <Link key={value} href={buildUrl(1, value || undefined, readFilter)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              (type ?? "") === value
                ? "bg-[#1a2744] text-white border-[#1a2744]"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}>
            {label}
          </Link>
        ))}
        <div className="w-px h-4 bg-gray-300 mx-1" />
        {/* 既読フィルタ */}
        {[
          { value: "",       label: "全て" },
          { value: "unread", label: "未読のみ" },
          { value: "read",   label: "既読のみ" },
        ].map(({ value, label }) => (
          <Link key={value} href={buildUrl(1, type, value || undefined)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              (readFilter ?? "") === value
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}>
            {label}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            {total === 0 ? "現在お知らせはありません" : "条件に一致するお知らせはありません"}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((n: any) => {
              const t = TYPE_LABEL[n.notifType] ?? { label: n.notifType, color: "bg-gray-100 text-gray-600" }
              return (
                <Link key={n.id} href={`/notifications/${n.id}`}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.isRead ? "bg-transparent" : "bg-blue-500"}`} />
                  <span className={`mt-0.5 inline-block px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap flex-shrink-0 ${t.color}`}>
                    {t.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${n.isRead ? "text-gray-500" : "font-medium text-gray-800"}`}>{n.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {n.publishedAt ? new Date(n.publishedAt).toLocaleDateString("ja-JP") : "—"}
                    </p>
                  </div>
                  <span className="text-gray-300 text-sm flex-shrink-0">›</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {page > 1 && (
            <Link href={buildUrl(page - 1, type, readFilter)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">← 前へ</Link>
          )}
          <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {totalPages}</span>
          {page < totalPages && (
            <Link href={buildUrl(page + 1, type, readFilter)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">次へ →</Link>
          )}
        </div>
      )}
    </div>
  )
}
''')

# ============================================================
# TASK B: EstimateNewClient — 保存後 estimateNo を表示
# ============================================================
def task_b():
    print("\n[TASK B] EstimateNewClient 保存後 estimateNo 表示")
    rep(
        "src/app/(app)/estimates/new/EstimateNewClient.tsx",
        "setSaveMessage({ type: \"success\", text: `見積を保存しました（見積No: ${saved.estimateNo}）` })",
        "setSaveMessage({ type: \"success\", text: `✅ 見積を保存しました　見積No: ${saved.estimateNo ?? saved.estimateId?.slice(0,8)}` })",
        "保存後estimateNo表示"
    )

# ============================================================
# TASK C: POST /api/v1/orders — 二重注文防止（409チェック）
# ============================================================
def task_c():
    print("\n[TASK C] POST /api/v1/orders 二重注文防止チェック")
    path = "src/app/api/v1/orders/route.ts"
    content = read(path)
    if "already_ordered" in content or "orderCount" in content or "409" in content:
        print("  ⏭️  既に実装済み")
        return

    rep(path,
        "  // 注文番号採番: Z + YYYYMMDD + 3桁連番",
        '''\
  // 二重注文防止チェック
  const existingOrder = await prisma.order.findFirst({
    where: { estimateHeaderId: estimateId, isDeleted: false },
  })
  if (existingOrder) {
    return NextResponse.json(
      { error: "この見積はすでに注文済みです", orderId: existingOrder.id, orderNo: existingOrder.orderNo },
      { status: 409 }
    )
  }

  // 注文番号採番: Z + YYYYMMDD + 3桁連番''',
        "二重注文防止チェック追加"
    )

# ============================================================
# TASK D: POST /api/v1/estimates/[id]/cancel — キャンセルAPI
# ============================================================
def task_d():
    print("\n[TASK D] POST /api/v1/estimates/[id]/cancel 実装")
    write("src/app/api/v1/estimates/[id]/cancel/route.ts", '''\
// POST /api/v1/estimates/[id]/cancel — 見積キャンセル（論理削除）
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const estimate = await prisma.estimateHeader.findFirst({
    where: { id, customerId: session.user.customerId!, isDeleted: false },
  })
  if (!estimate) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (estimate.estimateStatus === "ordered") {
    return NextResponse.json({ error: "注文済みの見積はキャンセルできません" }, { status: 422 })
  }

  await prisma.estimateHeader.update({
    where: { id },
    data: { estimateStatus: "cancelled", isDeleted: true },
  })
  return NextResponse.json({ cancelled: true, id })
}
''')

# ============================================================
# メイン
# ============================================================
def main():
    print("=" * 60)
    print("fix_session24.py 開始")
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
        "feat: notifications未読フィルタ/二重注文防止409/estimateキャンセルAPI"],
        check=True, cwd=str(ROOT))
    subprocess.run(["git", "push"], check=True, cwd=str(ROOT))
    print("✅ push完了")

if __name__ == "__main__":
    main()
