"use client"
// 自動既読処理（マウント時にPATCH）
import { useEffect } from "react"

export default function NotificationDetailClient({ id }: { id: string }) {
  useEffect(() => {
    fetch(`/api/v1/notifications/${id}/read`, { method: "PATCH" }).catch(() => {})
  }, [id])
  return null
}
