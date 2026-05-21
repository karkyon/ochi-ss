// src/components/ui/OchiHeader.tsx
// 全画面共通ヘッダー（紺色トップバー）
"use client"
import Link from "next/link"
import { signOut } from "next-auth/react"

interface OchiHeaderProps {
  userName?: string
  companyName?: string
  showLogout?: boolean
}

export default function OchiHeader({ userName, companyName, showLogout = true }: OchiHeaderProps) {
  return (
    <div
      style={{
        background: "#1e3a5f",
        color: "#fff",
        padding: "6px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "11px",
        minHeight: "36px",
      }}
    >
      <Link href="/dashboard" style={{ color: "#fff", textDecoration: "none", fontWeight: 600, fontSize: "13px", letterSpacing: "0.3px" }}>
        <span style={{ color: "#f97316" }}>OCHI</span>WEB オーダーシステム
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {(userName || companyName) && (
          <div style={{ textAlign: "right", lineHeight: "1.4" }}>
            {userName && <div style={{ fontWeight: 500 }}>{userName}</div>}
            {companyName && <div style={{ fontSize: "10px", opacity: 0.8 }}>{companyName}</div>}
          </div>
        )}
        {showLogout && (
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "#fff",
              borderRadius: "4px",
              padding: "3px 10px",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            ログアウト
          </button>
        )}
      </div>
    </div>
  )
}
