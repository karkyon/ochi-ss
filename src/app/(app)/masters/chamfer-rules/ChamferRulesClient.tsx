"use client"
// /masters/chamfer-rules — Admin専用 面取りルール管理
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"

type Rule = {
  id: string
  materialCode: string
  processingSpecCode: number
  sizeAFrom: number | null
  sizeATo: number | null
  sizeBFrom: number | null
  sizeBTo: number | null
  limitChamfer4: number | null
  limitChamfer8: number | null
  maxChamfer4: number | null
  maxChamfer8: number | null
  priority: number
}

const EMPTY: Omit<Rule, "id"> = {
  materialCode: "", processingSpecCode: 0,
  sizeAFrom: null, sizeATo: null, sizeBFrom: null, sizeBTo: null,
  limitChamfer4: null, limitChamfer8: null, maxChamfer4: null, maxChamfer8: null,
  priority: 0,
}

function num(v: any) { return v != null && v !== "" ? Number(v) : null }

export default function ChamferRulesClient() {
  const [rules, setRules]     = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState<"new" | Rule | null>(null)
  const [form, setForm]       = useState<Omit<Rule,"id">>(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/v1/masters/chamfer-rules")
    const d   = await res.json()
    setRules(d.rules ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const openNew  = () => { setForm(EMPTY); setError(""); setModal("new") }
  const openEdit = (r: Rule) => { setForm({ materialCode: r.materialCode, processingSpecCode: r.processingSpecCode, sizeAFrom: r.sizeAFrom, sizeATo: r.sizeATo, sizeBFrom: r.sizeBFrom, sizeBTo: r.sizeBTo, limitChamfer4: r.limitChamfer4, limitChamfer8: r.limitChamfer8, maxChamfer4: r.maxChamfer4, maxChamfer8: r.maxChamfer8, priority: r.priority }); setError(""); setModal(r) }

  const save = async () => {
    if (!form.materialCode) { setError("材料コードは必須です"); return }
    if (!form.processingSpecCode) { setError("加工仕様コードは必須です"); return }
    setSaving(true); setError("")
    try {
      const isEdit = modal !== "new"
      const url    = isEdit ? `/api/v1/masters/chamfer-rules/${(modal as Rule).id}` : "/api/v1/masters/chamfer-rules"
      const method = isEdit ? "PATCH" : "POST"
      const payload = { ...form, processingSpecCode: Number(form.processingSpecCode), priority: Number(form.priority) }
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!res.ok) { const e = await res.json(); setError(e.error ?? "保存失敗"); return }
      setModal(null); load()
    } finally { setSaving(false) }
  }

  const del = async (r: Rule) => {
    if (!confirm(`面取りルール（${r.materialCode} / 仕様${r.processingSpecCode}）を削除しますか？`)) return
    await fetch(`/api/v1/masters/chamfer-rules/${r.id}`, { method: "DELETE" })
    load()
  }

  const fi = (key: keyof typeof form, v: string) => setForm(p => ({ ...p, [key]: v }))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">面取りルール管理</h1>
          <p className="text-xs text-gray-500 mt-0.5">Admin専用 — 材料×加工仕様別の面取り制限値を管理</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard" className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">← ダッシュボード</Link>
          <button onClick={openNew} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">＋ 新規登録</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="text-center py-20 text-gray-400">読み込み中...</div>
        ) : rules.length === 0 ? (
          <div className="text-center py-20 text-gray-400">ルールが登録されていません</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["材料コード","加工仕様CD","A寸法範囲","B寸法範囲","限度面取4C","限度面取8C","最大4C","最大8C","優先度","操作"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rules.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono">{r.materialCode}</td>
                    <td className="px-3 py-2 text-center">{r.processingSpecCode}</td>
                    <td className="px-3 py-2 text-center text-xs">{r.sizeAFrom ?? "—"}〜{r.sizeATo ?? "—"}</td>
                    <td className="px-3 py-2 text-center text-xs">{r.sizeBFrom ?? "—"}〜{r.sizeBTo ?? "—"}</td>
                    <td className="px-3 py-2 text-center">{r.limitChamfer4 ?? "—"}</td>
                    <td className="px-3 py-2 text-center">{r.limitChamfer8 ?? "—"}</td>
                    <td className="px-3 py-2 text-center">{r.maxChamfer4 ?? "—"}</td>
                    <td className="px-3 py-2 text-center">{r.maxChamfer8 ?? "—"}</td>
                    <td className="px-3 py-2 text-center">{r.priority}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(r)} className="px-2 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100">編集</button>
                        <button onClick={() => del(r)} className="px-2 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100">削除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{modal === "new" ? "新規登録" : "編集"}</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="px-6 py-4 grid grid-cols-2 gap-4">
              {[
                { label: "材料コード *", key: "materialCode", type: "text" },
                { label: "加工仕様コード *", key: "processingSpecCode", type: "number" },
                { label: "A寸法FROM", key: "sizeAFrom", type: "number" },
                { label: "A寸法TO", key: "sizeATo", type: "number" },
                { label: "B寸法FROM", key: "sizeBFrom", type: "number" },
                { label: "B寸法TO", key: "sizeBTo", type: "number" },
                { label: "限度面取4C", key: "limitChamfer4", type: "number" },
                { label: "限度面取8C", key: "limitChamfer8", type: "number" },
                { label: "最大面取4C", key: "maxChamfer4", type: "number" },
                { label: "最大面取8C", key: "maxChamfer8", type: "number" },
                { label: "優先度", key: "priority", type: "number" },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type={type}
                    value={form[key as keyof typeof form] ?? ""}
                    onChange={e => fi(key as keyof typeof form, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}
            </div>
            {error && <p className="px-6 text-sm text-red-600">{error}</p>}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">キャンセル</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
