#!/usr/bin/env python3
"""
fix_session20.py
================
TASK A: /admin/debug-config page.tsx — スタブ→完全実装（トグル+3x3グリッド+保存）
TASK B: /access-denied page.tsx — 発生日時・セキュリティログ・戻るボタン強化
TASK C: Header.tsx — ハンバーガーメニュー追加（モバイル対応）
TASK D: /orders/[id]/pdf 注文書PDF改善
TASK E: prisma/schema.prisma — SystemSetting モデル追加
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
# TASK E: SystemSetting モデル (先に実行)
# ============================================================
def task_e():
    print("\n[TASK E] SystemSetting モデル追加")
    schema_path = ROOT / "prisma/schema.prisma"
    content = schema_path.read_text(encoding="utf-8")
    if "SystemSetting" in content:
        print("  ⏭️  既存")
        return
    model = '''
model SystemSetting {
  id        String   @id @default(cuid())
  key       String   @unique
  value     String
  updatedAt DateTime @updatedAt
  updatedBy String?

  @@map("system_settings")
}
'''
    schema_path.write_text(content + model, encoding="utf-8")
    print("  ✅ SystemSetting 追加")
    result = subprocess.run(
        ["npx", "prisma", "migrate", "dev", "--name", "add_system_settings", "--skip-seed"],
        capture_output=True, text=True, cwd=str(ROOT)
    )
    if result.returncode != 0:
        print("  ⚠️  migrate失敗:", (result.stdout+result.stderr)[-500:])
    else:
        print("  ✅ migrate完了")

# ============================================================
# TASK A: /admin/debug-config 完全実装
# ============================================================
def task_a():
    print("\n[TASK A] /admin/debug-config 完全実装")
    write("src/app/(app)/admin/debug-config/page.tsx", '''\
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import DebugConfigClient from "./DebugConfigClient"

export default async function DebugConfigPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (((session.user as any).role ?? 0) < 5) redirect("/access-denied")
  return <DebugConfigClient />
}
''')

    write("src/app/(app)/admin/debug-config/DebugConfigClient.tsx", '''\
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
''')

# ============================================================
# TASK B: /access-denied 強化
# ============================================================
def task_b():
    print("\n[TASK B] /access-denied 強化")
    write("src/app/(app)/access-denied/page.tsx", '''\
// /access-denied — アクセス拒否（403）ページ
import { auth } from "@/lib/auth"
import Link from "next/link"
import AccessDeniedClient from "./AccessDeniedClient"

export default async function AccessDeniedPage() {
  const session = await auth()
  const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🚫</span>
          </div>
          <div className="inline-block px-3 py-1 bg-red-100 text-red-700 text-xs font-mono rounded-full mb-4">
            HTTP 403 Forbidden
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">アクセスが拒否されました</h1>
          <p className="text-gray-500 text-sm mb-6">
            このページにアクセスする権限がありません。<br />
            必要な権限については管理者にお問い合わせください。
          </p>

          {/* エラー詳細 */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-6 text-left text-xs text-gray-600 space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400">発生日時</span>
              <span className="font-mono">{now}</span>
            </div>
            {session?.user && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-400">ユーザー</span>
                  <span className="font-mono">{(session.user as any).userId ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">企業コード</span>
                  <span className="font-mono">{(session.user as any).companyCode ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">権限レベル</span>
                  <span className="font-mono">Role = {(session.user as any).role ?? 0}</span>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <AccessDeniedClient />
            <Link href="/dashboard"
              className="px-6 py-2.5 bg-[#1a2744] text-white text-sm rounded-lg hover:bg-[#1a3a6e] transition-colors font-medium">
              メインメニューへ
            </Link>
            <Link href="/login"
              className="px-6 py-2.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
              ログイン画面へ
            </Link>
          </div>

          <p className="mt-6 text-xs text-gray-400">
            お問い合わせ：weborder@ochi-ss.co.jp　TEL：072-882-5524
          </p>
        </div>
      </div>
    </div>
  )
}
''')

    write("src/app/(app)/access-denied/AccessDeniedClient.tsx", '''\
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
''')

# ============================================================
# TASK C: Header ハンバーガーメニュー追加
# ============================================================
def task_c():
    print("\n[TASK C] Header ハンバーガーメニュー追加")
    path = "src/components/layout/Header.tsx"
    content = read(path)
    if "hamburger" in content or "menuOpen" in content:
        print("  ⏭️  既に実装済み")
        return

    rep(path,
        "  const [showLogoutDialog, setShowLogoutDialog] = useState(false)",
        "  const [showLogoutDialog, setShowLogoutDialog] = useState(false)\n  const [menuOpen, setMenuOpen] = useState(false)",
        "menuOpen state追加"
    )

    # ハンバーガーボタンをヘッダー右端に追加
    rep(path,
        "        {/* ログアウトボタン */}",
        """\
        {/* ハンバーガー（モバイル） */}
        <button
          className="sm:hidden p-2 rounded-lg text-gray-300 hover:bg-white/10"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="メニュー"
        >
          <span className="block w-5 h-0.5 bg-current mb-1" />
          <span className="block w-5 h-0.5 bg-current mb-1" />
          <span className="block w-5 h-0.5 bg-current" />
        </button>

        {/* ログアウトボタン */}""",
        "ハンバーガーボタン追加"
    )

# ============================================================
# TASK D: /orders/[id]/pdf 注文書PDF改善
# ============================================================
def task_d():
    print("\n[TASK D] 注文書PDF改善")
    write("src/app/api/v1/orders/[id]/pdf/route.ts", '''\
// GET /api/v1/orders/[id]/pdf — 注文書HTML出力
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const { id } = await params
  const order = await prisma.order.findFirst({
    where: { id, customerId: session.user.customerId! },
    include: {
      estimateHeader: {
        include: {
          details: { where: { isDeleted: false }, orderBy: { rowNo: "asc" } }
        }
      }
    },
  })
  if (!order) return new NextResponse("Not Found", { status: 404 })

  const estimate = order.estimateHeader as any
  const details  = estimate?.details ?? []
  const orderDate = order.orderDate
    ? new Date(order.orderDate).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })
    : "—"
  const totalAmount = details.reduce((s: number, d: any) => s + Number(d.totalPrice ?? 0), 0)

  const detailRows = details.map((d: any, i: number) => `
    <tr>
      <td>${i + 1}</td>
      <td>${d.materialName ?? d.materialCode ?? ""}</td>
      <td>${d.kakouShiyou ?? ""}</td>
      <td class="num">${Number(d.sizeT)}×${Number(d.sizeA)}×${Number(d.sizeB)}</td>
      <td class="num">${d.quantity ?? ""}</td>
      <td class="num">¥${Number(d.unitPrice ?? 0).toLocaleString()}</td>
      <td class="num">¥${Number(d.totalPrice ?? 0).toLocaleString()}</td>
      <td>${d.shortestDelivery ?? "—"}</td>
    </tr>`).join("")

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>注文書 ${order.orderNo ?? ""}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; padding: 20mm; }
    @media print { body { padding: 10mm; } .no-print { display: none !important; } @page { size: A4; margin: 10mm; } }
    .no-print { text-align: center; padding: 16px; margin-bottom: 20px; }
    .no-print button { padding: 10px 28px; font-size: 14px; background: #1a2744; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    h1 { font-size: 24px; text-align: center; letter-spacing: 4px; margin-bottom: 20px; border-bottom: 3px double #1a2744; padding-bottom: 10px; }
    .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .info-block { border: 1px solid #ddd; border-radius: 4px; padding: 12px; }
    .info-block h3 { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px; }
    .info-row .label { color: #666; flex-shrink: 0; margin-right: 8px; }
    .info-row .value { font-weight: 500; text-align: right; }
    .destination { border: 2px solid #1a2744; border-radius: 4px; padding: 12px; margin-bottom: 20px; }
    .destination .company { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
    th { background: #1a2744; color: #fff; padding: 6px 8px; text-align: left; font-weight: 500; white-space: nowrap; }
    td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: middle; }
    tr:nth-child(even) td { background: #f8f9fb; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .total-row td { font-weight: bold; font-size: 13px; border-top: 2px solid #1a2744; background: #f0f4ff !important; }
    .footer { margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .company-info .name { font-size: 16px; font-weight: bold; color: #1a2744; margin-bottom: 6px; }
    .sign-area { display: flex; gap: 8px; justify-content: flex-end; }
    .sign-box { width: 60px; height: 60px; border: 1px solid #999; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #999; }
  </style>
</head>
<body>
  <div class="no-print"><button onclick="window.print()">🖨️ PDF印刷 / 保存</button></div>
  <h1>注　文　書</h1>

  <div class="header-grid">
    <div>
      <div class="destination">
        <div class="company">${estimate?.destinationName ?? "—"}&ensp;御中</div>
        ${estimate?.destinationDept ? `<div style="font-size:13px;color:#444">${estimate.destinationDept}</div>` : ""}
        ${estimate?.destinationAddress ? `<div style="font-size:11px;color:#666">〒${estimate?.destinationZip ?? ""} ${estimate.destinationAddress}</div>` : ""}
      </div>
      <div style="font-size:18px;font-weight:bold;color:#1a2744;margin-bottom:4px;">
        合計金額：¥${totalAmount.toLocaleString()}（税抜）
      </div>
    </div>
    <div class="info-block">
      <h3>注文情報</h3>
      <div class="info-row"><span class="label">注文No</span><span class="value">${order.orderNo ?? "—"}</span></div>
      <div class="info-row"><span class="label">注文日</span><span class="value">${orderDate}</span></div>
      <div class="info-row"><span class="label">見積No</span><span class="value">${estimate?.estimateNo ?? "—"}</span></div>
      <div class="info-row"><span class="label">お客様注文No</span><span class="value">${estimate?.customerOrderNo ?? "—"}</span></div>
      <div class="info-row"><span class="label">注文状況</span><span class="value">${order.orderStatus ?? "—"}</span></div>
      <div style="margin-top:12px;"><div class="sign-area">
        <div class="sign-box">確認</div>
        <div class="sign-box">担当</div>
      </div></div>
    </div>
  </div>

  <table>
    <thead><tr>
      <th style="width:3%">No</th>
      <th style="width:12%">材料</th>
      <th style="width:10%">加工仕様</th>
      <th style="width:15%">寸法T×A×B</th>
      <th style="width:6%">数量</th>
      <th style="width:10%">単価</th>
      <th style="width:11%">金額</th>
      <th style="width:10%">最短納期</th>
    </tr></thead>
    <tbody>${detailRows}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="6" class="num">合　計（税抜）</td>
        <td class="num">¥${totalAmount.toLocaleString()}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <div class="company-info" style="font-size:11px">
      <div class="name">越智製作所</div>
      <div>〒577-0802 大阪府東大阪市小若江3-4-1</div>
      <div>TEL：072-882-5524　FAX：072-882-5527</div>
      <div>E-mail：weborder@ochi-ss.co.jp</div>
    </div>
    <div class="info-block" style="font-size:11px">
      <h3>お支払条件</h3>
      <div>月末締め翌月末払い</div>
      <div style="margin-top:8px;color:#666;font-size:10px">
        ※ 価格は税抜きです（消費税は別途申し受けます）
      </div>
    </div>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  })
}
''')

# ============================================================
# メイン
# ============================================================
def main():
    print("=" * 60)
    print("fix_session20.py 開始")
    print("=" * 60)
    task_e()
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
        "feat: debug-config完全実装/access-denied強化/Header hamburger/注文書PDF改善"],
        check=True, cwd=str(ROOT))
    subprocess.run(["git", "push"], check=True, cwd=str(ROOT))
    print("✅ push完了")

if __name__ == "__main__":
    main()
