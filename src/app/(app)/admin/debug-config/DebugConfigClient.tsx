"use client"
import { useState, useEffect } from "react"
import Link from "next/link"

type Config = {
  debugMode: boolean
  showEstimateCalcParams: boolean
  showIntermediateValues: boolean
  showSpSql: boolean
  showRawApiResponse: boolean
  showRequestParams: boolean
  showSessionInfo: boolean
  showPerformanceMetrics: boolean
  showSqlQueryLog: boolean
  logLevel: string
  spTimeoutSec: number
  pollingIntervalSec: number
}

const DEFAULT: Config = {
  debugMode: false,
  showEstimateCalcParams: false, showIntermediateValues: false, showSpSql: false,
  showRawApiResponse: false, showRequestParams: false, showSessionInfo: false,
  showPerformanceMetrics: false, showSqlQueryLog: false,
  logLevel: "INFO", spTimeoutSec: 120, pollingIntervalSec: 30,
}

const PARAM_ITEMS = [
  { key: "showEstimateCalcParams",   label: "見積計算パラメータ",   desc: "計算APIの入力85パラメータを表示" },
  { key: "showIntermediateValues",   label: "中間計算値",           desc: "材料重量・加工コスト等の中間値" },
  { key: "showSpSql",                label: "SP実行SQLスクリプト",  desc: "SQL Server SP呼び出しのSQLを表示" },
  { key: "showRawApiResponse",       label: "APIレスポンス(生)",    desc: "計算API・マスタAPIの生JSONを表示" },
  { key: "showRequestParams",        label: "リクエストパラメータ", desc: "フロント→API送信データを表示" },
  { key: "showSessionInfo",          label: "セッション情報",       desc: "得意先コード・ユーザーID等" },
  { key: "showPerformanceMetrics",   label: "パフォーマンス計測",   desc: "API応答時間・DBクエリ時間" },
  { key: "showSqlQueryLog",          label: "SQLクエリログ",        desc: "Prismaが発行するSQLを表示" },
]

export default function DebugConfigClient() {
  const [config, setConfig] = useState<Config>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [msg, setMsg] = useState<{ type: "success"|"error"; text: string } | null>(null)

  useEffect(() => {
    fetch("/api/v1/admin/debug-config")
      .then(r => r.json())
      .then(d => { setConfig(d.config ?? DEFAULT) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch("/api/v1/admin/debug-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error("保存失敗")
      setMsg({ type: "success", text: "✅ 設定を保存しました" })
    } catch (e: any) {
      setMsg({ type: "error", text: `❌ ${e.message}` })
    } finally { setSaving(false) }
  }

  const reset = () => { setConfig(DEFAULT); setMsg({ type: "success", text: "デフォルト値に戻しました（まだ保存されていません）" }) }
  const selectAll = () => setConfig(p => ({ ...p, ...Object.fromEntries(PARAM_ITEMS.map(i => [i.key, true])) }))
  const deselectAll = () => setConfig(p => ({ ...p, ...Object.fromEntries(PARAM_ITEMS.map(i => [i.key, false])) }))

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400">読み込み中...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">⚙️ デバッグ設定管理</h1>
          <p className="text-xs text-gray-500 mt-0.5">SystemAdmin (Role=5) 専用</p>
        </div>
        <Link href="/dashboard" className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">← ダッシュボード</Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-6">

        {/* デバッグモード */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800">デバッグモード</p>
              <p className="text-xs text-gray-500 mt-0.5">有効にすると詳細ログと開発情報が表示されます</p>
            </div>
            <button
              onClick={() => setConfig(p => ({ ...p, debugMode: !p.debugMode }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${config.debugMode ? "bg-indigo-600" : "bg-gray-300"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${config.debugMode ? "translate-x-6" : ""}`} />
            </button>
          </div>
          {config.debugMode && (
            <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs">
              ⚠️ デバッグモードが有効です。本番環境での使用は推奨しません。
            </div>
          )}
        </div>

        {/* パラメータ表示設定 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-gray-800">パラメータ表示設定</p>
            <div className="flex gap-2">
              <button onClick={selectAll} className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">☑️ 全選択</button>
              <button onClick={deselectAll} className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">☐ 全解除</button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PARAM_ITEMS.map(({ key, label, desc }) => (
              <label key={key} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                (config as any)[key] ? "border-indigo-300 bg-indigo-50" : "border-gray-200 hover:bg-gray-50"
              }`}>
                <input
                  type="checkbox"
                  checked={(config as any)[key] ?? false}
                  onChange={e => setConfig(p => ({ ...p, [key]: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 text-indigo-600 rounded"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* システム設定 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="font-semibold text-gray-800 mb-4">システム設定</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ログレベル</label>
              <select
                value={config.logLevel}
                onChange={e => setConfig(p => ({ ...p, logLevel: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              >
                {["DEBUG","INFO","WARN","ERROR"].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">SP実行タイムアウト（秒）</label>
              <input type="number" value={config.spTimeoutSec}
                onChange={e => setConfig(p => ({ ...p, spTimeoutSec: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" min={10} max={600} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pollingインターバル（秒）</label>
              <input type="number" value={config.pollingIntervalSec}
                onChange={e => setConfig(p => ({ ...p, pollingIntervalSec: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" min={5} max={300} />
            </div>
          </div>
        </div>

        {msg && (
          <div className={`px-4 py-3 rounded-xl text-sm ${msg.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {msg.text}
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex justify-between items-center">
          <button onClick={reset} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
            🔄 デフォルトにリセット
          </button>
          <button onClick={save} disabled={saving}
            className="px-6 py-2.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
            {saving ? "保存中..." : "💾 設定を保存"}
          </button>
        </div>
      </main>
    </div>
  )
}
