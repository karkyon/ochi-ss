"use client"
import { useEffect, useState } from "react"

const FIELDS: { key: string; label: string }[] = [
  { key: "company_name", label: "会社名" },
  { key: "company_zip", label: "郵便番号" },
  { key: "company_address", label: "住所" },
  { key: "company_tel", label: "TEL" },
  { key: "company_fax", label: "FAX" },
  { key: "company_email", label: "E-mail" },
  { key: "payment_terms", label: "お支払条件" },
]

export default function CompanySettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/admin/company-settings")
        if (!res.ok) { setMessage({ type: "error", text: "設定の取得に失敗しました" }); return }
        const data = await res.json()
        setValues(data.settings ?? {})
      } catch {
        setMessage({ type: "error", text: "通信エラーが発生しました" })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleSave = async () => {
    setSaving(true); setMessage(null)
    try {
      const res = await fetch("/api/v1/admin/company-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "保存に失敗しました")
      setMessage({ type: "ok", text: "保存しました。見積書PDFに反映されます。" })
    } catch (e: any) {
      setMessage({ type: "error", text: e.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: "24px", color: "#94a3b8", fontSize: "13px" }}>読み込み中...</div>

  return (
    <div style={{ maxWidth: "640px" }}>
      <div style={{ marginBottom: "18px" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>自社情報設定</h1>
        <p style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>見積書PDFのフッターに表示される自社情報を編集します。</p>
      </div>

      {message && (
        <div style={{
          background: message.type === "ok" ? "#f0fdf4" : "#fef2f2",
          border: "1px solid " + (message.type === "ok" ? "#86efac" : "#fca5a5"),
          color: message.type === "ok" ? "#166534" : "#991b1b",
          borderRadius: "6px", padding: "8px 12px", fontSize: "12px", marginBottom: "14px",
        }}>{message.text}</div>
      )}

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "20px" }}>
        {FIELDS.map(f => (
          <div key={f.key} style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>{f.label}</label>
            <input
              value={values[f.key] ?? ""}
              onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              style={{
                width: "100%", border: "1.5px solid #94a3b8", borderRadius: "6px",
                padding: "8px 10px", fontSize: "13px", boxSizing: "border-box",
              }}
            />
          </div>
        ))}
        <button
          onClick={handleSave} disabled={saving}
          style={{
            marginTop: "6px", padding: "10px 24px", fontSize: "13px", fontWeight: 600,
            background: saving ? "#94a3b8" : "#1e3a5f", color: "#fff", border: "none",
            borderRadius: "8px", cursor: saving ? "not-allowed" : "pointer",
          }}
        >{saving ? "保存中..." : "💾 保存"}</button>
      </div>
    </div>
  )
}
