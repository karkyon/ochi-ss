"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

// 2026/07/13 修正: サイドバーは「ダッシュボード」「自社情報設定」のみに整理
// (見積一覧・注文一覧・直送先管理はメニューから削除。各画面へは既存の
//  グローバルメニューから遷移する運用のため、管理画面側では割愛)
const NAV_ITEMS = [
  { href: "/admin", icon: "\ud83d\udcca", label: "\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9" },
  { href: "/admin/company", icon: "\ud83c\udfe2", label: "\u81ea\u793e\u60c5\u5831\u8a2d\u5b9a" },
]

interface Props {
  children: React.ReactNode
  userName: string
  companyName: string
}

export default function AdminShell({ children, userName, companyName }: Props) {
  const pathname = usePathname()

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f1f5f9" }}>
      {/* サイドバー */}
      <aside style={{ width: "230px", background: "#0f172a", color: "#e2e8f0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "18px 16px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>OCHIWEB 管理</div>
          <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>{companyName}</div>
        </div>
        <nav style={{ flex: 1, padding: "10px 8px" }}>
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "9px 12px", borderRadius: "6px", marginBottom: "2px",
                  fontSize: "12.5px", textDecoration: "none",
                  color: active ? "#fff" : "#cbd5e1",
                  background: active ? "#1d4ed8" : "transparent",
                  fontWeight: active ? 600 : 400,
                }}>
                <span>{item.icon}</span><span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #1e293b" }}>
          <Link href="/dashboard" style={{ fontSize: "11px", color: "#94a3b8", textDecoration: "none" }}>← メインメニューへ戻る</Link>
        </div>
      </aside>

      {/* メインエリア */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* ヘッダー */}
        <header style={{
          height: "56px", background: "#fff", borderBottom: "1px solid #e2e8f0",
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0,
        }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>管理者メニュー</div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "30px", height: "30px", borderRadius: "50%", background: "#e2e8f0",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#475569",
            }}>{"\ud83d\udc64"}</div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>{userName || "管理者"}</div>
              <div style={{ fontSize: "10px", color: "#94a3b8" }}>管理者</div>
            </div>
          </div>
        </header>

        {/* メインコンテンツ */}
        <main style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  )
}
