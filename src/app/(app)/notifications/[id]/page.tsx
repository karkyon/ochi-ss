// /notifications/[id] — お知らせ詳細（自動既読付き）
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import NotificationDetailClient from "./NotificationDetailClient"
import NotificationReplyClient from "./NotificationReplyClient"

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  info:    { label: "お知らせ",   color: "bg-blue-100 text-blue-700" },
  warning: { label: "重要",       color: "bg-yellow-100 text-yellow-700" },
  urgent:  { label: "緊急",       color: "bg-red-100 text-red-600" },
}

interface Props { params: Promise<{ id: string }> }

export default async function NotificationDetailPage({ params }: Props) {
  const { id } = await params
  let notification: any = null
  try {
    notification = await prisma.notification.findFirst({
      where: { id, isDeleted: false },
    })
  } catch { notFound() }
  if (!notification) notFound()

  const t = TYPE_LABEL[notification.notifType] ?? { label: notification.notifType, color: "bg-gray-100 text-gray-600" }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-5">
        <Link href="/notifications" className="text-gray-400 hover:text-gray-600 text-sm">← お知らせ一覧</Link>
      </div>
      <NotificationDetailClient id={id} />
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${t.color}`}>{t.label}</span>
          <span className="text-xs text-gray-400">
            {notification.publishedAt ? new Date(notification.publishedAt).toLocaleDateString("ja-JP") : "—"}
          </span>
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-6">{notification.title}</h1>
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{notification.content}</div>
      </div>
      {(notification as any).canReply && (
        <NotificationReplyClient notificationId={id} />
      )}
    </div>
  )
}
