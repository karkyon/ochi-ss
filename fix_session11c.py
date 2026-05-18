#!/usr/bin/env python3
"""
fix_session11c.py
=================
TASK G: POST /api/v1/orders + /orders/confirm + /orders/complete
TASK H: /masters/direct-delivery (CRUD UI + API)
TASK I: /notifications + /notifications/[id]
TASK J: /orders/[id]/pdf (注文書PDF)
TASK K: dashboard href /delivery-destinations → /masters/direct-delivery
"""

import subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def write(path_str, content):
    path = ROOT / path_str
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(f"  ✅ 作成: {path_str}")

def replace_once(path_str, old, new, label):
    path = ROOT / path_str
    content = path.read_text(encoding="utf-8")
    if old not in content:
        print(f"  ❌ [{label}] アンカー未発見")
        return False
    path.write_text(content.replace(old, new, 1), encoding="utf-8")
    print(f"  ✅ [{label}] 置換成功")
    return True

# ============================================================
# TASK G: 注文フロー
# ============================================================
def task_g():
    print("\n[TASK G] 注文フロー実装")

    # POST /api/v1/orders
    write("src/app/api/v1/orders/route.ts", '''\
// src/app/api/v1/orders/route.ts
// GET /api/v1/orders — 注文一覧
// POST /api/v1/orders — 注文確定

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

// ── GET 一覧 ──
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const dateFrom = searchParams.get("dateFrom")
  const dateTo   = searchParams.get("dateTo")
  const orderNo  = searchParams.get("orderNo")
  const status   = searchParams.get("status")
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const perPage  = 20

  const where: Prisma.OrderWhereInput = {
    customerId: session.user.customerId!,
    isDeleted: false,
    ...(dateFrom && { orderDate: { gte: new Date(dateFrom) } }),
    ...(dateTo   && { orderDate: { lte: new Date(dateTo + "T23:59:59") } }),
    ...(orderNo  && { orderNo: { contains: orderNo } }),
    ...(status   && { orderStatus: status }),
  }

  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { orderDate: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        estimateHeader: {
          select: { estimateNo: true, destinationName: true, customerOrderNo: true },
        },
      },
    }),
  ])

  return NextResponse.json({
    total, page, perPage,
    totalPages: Math.ceil(total / perPage),
    orders: rows.map(o => ({
      id: o.id,
      orderNo: o.orderNo ?? null,
      orderDate: o.orderDate.toISOString().slice(0, 10),
      orderStatus: o.orderStatus,
      totalAmount: Number(o.totalAmount ?? 0),
      detailCount: o.detailCount ?? 0,
      estimateNo: o.estimateHeader.estimateNo ?? null,
      destinationName: o.estimateHeader.destinationName ?? null,
      customerOrderNo: o.estimateHeader.customerOrderNo ?? null,
    })),
  })
}

// ── POST 注文確定 ──
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { estimateId } = body as { estimateId: string }

  if (!estimateId) {
    return NextResponse.json({ error: "estimateId required" }, { status: 400 })
  }

  console.log("[POST /api/v1/orders] estimateId:", estimateId)

  // 見積取得・バリデーション
  const estimate = await prisma.estimateHeader.findFirst({
    where: { id: estimateId, customerId: session.user.customerId!, isDeleted: false },
    include: { details: { where: { isDeleted: false } } },
  })
  if (!estimate) return NextResponse.json({ error: "見積が見つかりません" }, { status: 404 })
  if (estimate.estimateStatus === "ordered") {
    return NextResponse.json({ error: "この見積は既に注文済みです" }, { status: 409 })
  }
  if (estimate.details.length === 0) {
    return NextResponse.json({ error: "明細が1件もありません" }, { status: 400 })
  }

  const totalAmount = estimate.details.reduce((s, d) => s + Number(d.totalPrice ?? 0), 0)
  const detailCount = estimate.details.length

  // 注文レコード作成 + 見積ステータス更新 (transaction)
  const order = await prisma.$transaction(async tx => {
    const o = await tx.order.create({
      data: {
        estimateHeaderId: estimateId,
        customerId: session.user.customerId!,
        orderStatus: "pending",
        totalAmount,
        detailCount,
      },
    })
    await tx.estimateHeader.update({
      where: { id: estimateId },
      data: { estimateStatus: "ordered" },
    })
    return o
  })

  return NextResponse.json({ orderId: order.id, orderStatus: order.orderStatus }, { status: 201 })
}
''')

    # /orders/confirm
    write("src/app/(app)/orders/confirm/page.tsx", '''\
// /orders/confirm — 注文確認ページ
"use client"
import { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export default function OrderConfirmPage() {
  const router = useRouter()
  const sp = useSearchParams()
  const estimateId = sp.get("estimateId")

  const [estimate, setEstimate] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [ordering, setOrdering] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!estimateId) { router.replace("/estimates"); return }
    fetch(`/api/v1/estimates/${estimateId}`)
      .then(r => r.json())
      .then(d => { setEstimate(d); setLoading(false) })
      .catch(() => { setError("データ取得失敗"); setLoading(false) })
  }, [estimateId, router])

  const handleOrder = useCallback(async () => {
    if (!estimateId) return
    setOrdering(true); setError("")
    try {
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "注文失敗")
      router.replace(`/orders/complete?orderId=${data.orderId}`)
    } catch (e: any) {
      setError(e.message); setOrdering(false)
    }
  }, [estimateId, router])

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-400">読み込み中...</div>

  const totalAmount = estimate?.details?.reduce((s: number, d: any) => s + (d.totalPrice ?? 0), 0) ?? 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-1 h-6 rounded-full bg-[#1a2744]" />
        <h1 className="font-bold text-gray-800 text-lg">注文確認</h1>
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {estimate && (
        <>
          {/* ヘッダー情報 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">注文内容確認</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div><p className="text-[10px] text-gray-400">見積No</p><p className="font-medium">{estimate.estimateNo ?? "—"}</p></div>
              <div><p className="text-[10px] text-gray-400">得意先名</p><p className="font-medium">{estimate.customerName ?? "—"}</p></div>
              <div><p className="text-[10px] text-gray-400">送り先名</p><p className="font-medium">{estimate.destinationName ?? "—"}</p></div>
              <div><p className="text-[10px] text-gray-400">合計金額（税別）</p><p className="font-bold text-lg">¥{totalAmount.toLocaleString()}</p></div>
              <div><p className="text-[10px] text-gray-400">明細件数</p><p className="font-medium">{estimate.details?.length ?? 0}件</p></div>
            </div>
          </div>

          {/* 明細テーブル */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">注文明細</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">No</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">材料</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">加工仕様</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">T</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">A</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">B</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">数量</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">単価</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">金額</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">最短納期</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {estimate.details?.map((d: any, i: number) => (
                    <tr key={d.rowNo} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-center text-gray-500">{i + 1}</td>
                      <td className="px-3 py-2 text-gray-700">{d.materialCode} <span className="text-xs text-gray-400">{d.materialName}</span></td>
                      <td className="px-3 py-2 text-gray-700">{d.kakouShiyou ?? "—"}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{d.sizeT}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{d.sizeA}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{d.sizeB}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{d.quantity}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{d.unitPrice != null ? `¥${Number(d.unitPrice).toLocaleString()}` : "—"}</td>
                      <td className="px-3 py-2 text-right font-medium">{d.totalPrice != null ? `¥${Number(d.totalPrice).toLocaleString()}` : "—"}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{d.shortestDelivery ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              ← 入力画面へ戻る
            </button>
            <button
              type="button"
              onClick={handleOrder}
              disabled={ordering}
              className="px-6 py-2.5 rounded-lg bg-[#1a2744] text-white font-medium hover:bg-[#243561] disabled:opacity-50 transition-colors"
            >
              {ordering ? "処理中..." : "✅ 注文確定"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
''')

    # /orders/complete
    write("src/app/(app)/orders/complete/page.tsx", '''\
// /orders/complete — 注文完了ページ
"use client"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

export default function OrderCompletePage() {
  const sp = useSearchParams()
  const orderId = sp.get("orderId")

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">ご注文ありがとうございます</h1>
        <p className="text-gray-500 mb-8">注文を承りました。確認後、担当者よりご連絡いたします。</p>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-8 text-sm text-blue-800">
          <p className="font-semibold mb-1">お問い合わせ先</p>
          <p>越智製作所　TEL: 072-882-5524</p>
          <p>E-mail: weborder@ochi-ss.co.jp</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {orderId && (
            <Link
              href={`/orders/${orderId}`}
              className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm"
            >
              注文詳細を確認
            </Link>
          )}
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-lg bg-[#1a2744] text-white hover:bg-[#243561] transition-colors text-sm"
          >
            メインメニューへ
          </Link>
        </div>
      </div>
    </div>
  )
}
''')

    # GET /api/v1/estimates/[id] (注文確認画面が参照する)
    # 既存かどうか確認してから作成
    api_path = ROOT / "src/app/api/v1/estimates/[id]/route.ts"
    if api_path.exists():
        content = api_path.read_text(encoding="utf-8")
        if "export async function GET" not in content:
            # GETが無ければ先頭に追加
            insert = '''\
// GET — 見積単体取得
export async function GET(req: import("next/server").NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { auth } = await import("@/lib/auth")
  const { prisma } = await import("@/lib/prisma")
  const { NextResponse } = await import("next/server")
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const estimate = await prisma.estimateHeader.findFirst({
    where: { id, customerId: session.user.customerId!, isDeleted: false },
    include: { details: { where: { isDeleted: false }, orderBy: { rowNo: "asc" } } },
  })
  if (!estimate) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({
    id: estimate.id,
    estimateNo: estimate.estimateNo ?? null,
    estimateStatus: estimate.estimateStatus,
    customerName: estimate.customerName,
    customerCode: estimate.customerCode,
    customerOrderNo: estimate.customerOrderNo ?? null,
    destinationName: estimate.destinationName ?? null,
    remarks: estimate.remarks ?? null,
    details: estimate.details.map(d => ({
      rowNo: d.rowNo, materialCode: d.materialCode, materialName: d.materialName ?? null,
      kakouShiyou: d.kakouShiyou ?? null,
      sizeT: Number(d.sizeT), sizeA: Number(d.sizeA), sizeB: Number(d.sizeB),
      quantity: d.quantity,
      unitPrice: d.unitPrice != null ? Number(d.unitPrice) : null,
      totalPrice: d.totalPrice != null ? Number(d.totalPrice) : null,
      shortestDelivery: d.shortestDelivery ?? null,
    })),
  })
}

'''
            api_path.write_text(insert + content, encoding="utf-8")
            print("  ✅ [estimates/[id]/route GET追加]")
        else:
            print("  ✅ [estimates/[id]/route GET] 既存 — スキップ")
    else:
        print("  ⚠ estimates/[id]/route.ts が見つかりません — スキップ")

# ============================================================
# TASK H: /masters/direct-delivery
# ============================================================
def task_h():
    print("\n[TASK H] /masters/direct-delivery 実装")

    write("src/app/(app)/masters/direct-delivery/page.tsx", '''\
// /masters/direct-delivery — 直送先管理ページ (Server Component)
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import DirectDeliveryClient from "./DirectDeliveryClient"

export default async function DirectDeliveryPage() {
  const session = await auth()

  const rows = await prisma.directDelivery.findMany({
    where: { customerId: session!.user.customerId!, isDeleted: false },
    orderBy: { deliveryCode: "asc" },
  })

  const deliveries = rows.map(r => ({
    id:             r.id,
    deliveryCode:   r.deliveryCode,
    companyName:    r.companyName,
    departmentName: r.departmentName ?? "",
    contactPerson:  r.contactPerson ?? "",
    postalCode:     r.postalCode ?? "",
    address1:       r.address1 ?? "",
    phoneNumber:    r.phoneNumber ?? "",
    faxNumber:      r.faxNumber ?? "",
    remarks:        r.remarks ?? "",
  }))

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-[#1a2744]" />
          <h1 className="font-bold text-gray-800 text-lg">納入先管理</h1>
        </div>
        <Link href="/dashboard" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors">
          メインメニュー
        </Link>
      </div>
      <DirectDeliveryClient deliveries={deliveries} customerCode={session!.user.companyCode ?? ""} customerId={session!.user.customerId ?? ""} />
    </div>
  )
}
''')

    write("src/app/(app)/masters/direct-delivery/DirectDeliveryClient.tsx", '''\
// DirectDeliveryClient.tsx — 直送先CRUD UI
"use client"
import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"

type DD = {
  id: string
  deliveryCode: string
  companyName: string
  departmentName: string
  contactPerson: string
  postalCode: string
  address1: string
  phoneNumber: string
  faxNumber: string
  remarks: string
}

const EMPTY: Omit<DD, "id"> = {
  deliveryCode: "", companyName: "", departmentName: "", contactPerson: "",
  postalCode: "", address1: "", phoneNumber: "", faxNumber: "", remarks: "",
}

interface Props {
  deliveries: DD[]
  customerCode: string
  customerId: string
}

export default function DirectDeliveryClient({ deliveries: initial, customerCode, customerId }: Props) {
  const router = useRouter()
  const [list, setList] = useState<DD[]>(initial)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<DD | null>(null)
  const [form, setForm] = useState<Omit<DD, "id">>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  const openNew = () => { setForm(EMPTY); setEditTarget(null); setError(""); setShowModal(true) }
  const openEdit = (d: DD) => { setForm({ deliveryCode: d.deliveryCode, companyName: d.companyName, departmentName: d.departmentName, contactPerson: d.contactPerson, postalCode: d.postalCode, address1: d.address1, phoneNumber: d.phoneNumber, faxNumber: d.faxNumber, remarks: d.remarks }); setEditTarget(d); setError(""); setShowModal(true) }

  const handleSave = useCallback(async () => {
    if (!form.deliveryCode || !form.companyName) { setError("直送先コード・名称は必須です"); return }
    setSaving(true); setError("")
    try {
      const url = editTarget ? `/api/v1/masters/direct-delivery/${editTarget.id}` : "/api/v1/masters/direct-delivery"
      const method = editTarget ? "PATCH" : "POST"
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, customerCode, customerId }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "保存失敗")
      setShowModal(false)
      router.refresh()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }, [form, editTarget, customerCode, customerId, router])

  const handleDelete = useCallback(async (d: DD) => {
    if (!confirm(`「${d.companyName}」を削除しますか？`)) return
    const res = await fetch(`/api/v1/masters/direct-delivery/${d.id}`, { method: "DELETE" })
    if (res.ok) router.refresh()
    else alert("削除失敗")
  }, [router])

  const filtered = list.filter(d =>
    !search || d.companyName.includes(search) || d.deliveryCode.includes(search) || d.address1.includes(search)
  )

  const F = ({ label, k, placeholder = "" }: { label: string; k: keyof typeof EMPTY; placeholder?: string }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type="text" value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  )

  return (
    <>
      {/* 検索+新規 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 flex gap-3 items-center">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="会社名・コード・住所で絞り込み"
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={openNew} className="px-4 py-2 text-sm font-medium rounded-lg bg-[#1a2744] text-white hover:bg-[#243561] transition-colors whitespace-nowrap">
          ＋ 新規登録
        </button>
      </div>

      {/* 一覧 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">納入先一覧 ({filtered.length}件)</p>
        </div>
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">登録された納入先がありません</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">コード</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">会社名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">部署名</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">担当者</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">TEL</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">住所</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{d.deliveryCode}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{d.companyName}</td>
                    <td className="px-4 py-3 text-gray-600">{d.departmentName || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{d.contactPerson || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{d.phoneNumber || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{d.postalCode ? `〒${d.postalCode} ` : ""}{d.address1 || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 justify-center">
                        <button onClick={() => openEdit(d)} className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors">編集</button>
                        <button onClick={() => handleDelete(d)} className="px-2.5 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors">削除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* モーダル */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="font-bold text-gray-800">{editTarget ? "納入先編集" : "納入先新規登録"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <F label="直送先コード ★" k="deliveryCode" placeholder="例: D001" />
              <F label="会社名 ★" k="companyName" placeholder="例: 越智工業株式会社" />
              <F label="部署名" k="departmentName" />
              <F label="担当者名" k="contactPerson" />
              <F label="郵便番号" k="postalCode" placeholder="000-0000" />
              <F label="住所" k="address1" />
              <F label="TEL" k="phoneNumber" placeholder="00-0000-0000" />
              <F label="FAX" k="faxNumber" placeholder="00-0000-0000" />
              <div className="sm:col-span-2"><F label="備考" k="remarks" /></div>
            </div>
            {error && <p className="px-6 pb-3 text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">キャンセル</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm font-medium rounded-lg bg-[#1a2744] text-white hover:bg-[#243561] disabled:opacity-50">
                {saving ? "保存中..." : "💾 保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
''')

    # API routes for direct-delivery
    write("src/app/api/v1/masters/direct-delivery/route.ts", '''\
// POST /api/v1/masters/direct-delivery — 新規登録
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json()
  const { deliveryCode, companyName, departmentName, contactPerson, postalCode, address1, phoneNumber, faxNumber, remarks } = body
  if (!deliveryCode || !companyName) return NextResponse.json({ error: "コード・名称は必須です" }, { status: 400 })
  try {
    const dd = await prisma.directDelivery.create({
      data: {
        customerId: session.user.customerId!,
        customerCode: session.user.companyCode ?? "",
        deliveryCode, companyName,
        departmentName: departmentName ?? null,
        contactPerson: contactPerson ?? null,
        postalCode: postalCode ?? null,
        address1: address1 ?? null,
        phoneNumber: phoneNumber ?? null,
        faxNumber: faxNumber ?? null,
        remarks: remarks ?? null,
      },
    })
    return NextResponse.json({ id: dd.id }, { status: 201 })
  } catch (e: any) {
    if (e.code === "P2002") return NextResponse.json({ error: "そのコードは既に登録されています" }, { status: 409 })
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
''')

    write("src/app/api/v1/masters/direct-delivery/[id]/route.ts", '''\
// PATCH / DELETE /api/v1/masters/direct-delivery/[id]
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface Props { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Props) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const { companyName, departmentName, contactPerson, postalCode, address1, phoneNumber, faxNumber, remarks } = body
  const dd = await prisma.directDelivery.findFirst({ where: { id, customerId: session.user.customerId!, isDeleted: false } })
  if (!dd) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await prisma.directDelivery.update({
    where: { id },
    data: { companyName, departmentName: departmentName ?? null, contactPerson: contactPerson ?? null, postalCode: postalCode ?? null, address1: address1 ?? null, phoneNumber: phoneNumber ?? null, faxNumber: faxNumber ?? null, remarks: remarks ?? null },
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: Props) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const dd = await prisma.directDelivery.findFirst({ where: { id, customerId: session.user.customerId!, isDeleted: false } })
  if (!dd) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await prisma.directDelivery.update({ where: { id }, data: { isDeleted: true } })
  return NextResponse.json({ ok: true })
}
''')

# ============================================================
# TASK I: /notifications
# ============================================================
def task_i():
    print("\n[TASK I] /notifications 実装")

    write("src/app/(app)/notifications/page.tsx", '''\
// /notifications — お知らせ一覧
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  info:    { label: "お知らせ",   color: "bg-blue-100 text-blue-700" },
  warning: { label: "重要",       color: "bg-yellow-100 text-yellow-700" },
  urgent:  { label: "緊急",       color: "bg-red-100 text-red-600" },
}

export default async function NotificationsPage() {
  const session = await auth()
  const customerId = session!.user.customerId!

  let notifications: any[] = []
  try {
    const now = new Date()
    notifications = await prisma.notification.findMany({
      where: {
        isDeleted: false,
        publishedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      orderBy: [{ publishedAt: "desc" }],
      take: 50,
    })
  } catch { notifications = [] }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-[#1a2744]" />
          <h1 className="font-bold text-gray-800 text-lg">お知らせ一覧</h1>
        </div>
        <Link href="/dashboard" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors">
          メインメニュー
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {notifications.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">現在お知らせはありません</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((n: any) => {
              const t = TYPE_LABEL[n.notifType] ?? { label: n.notifType, color: "bg-gray-100 text-gray-600" }
              return (
                <Link key={n.id} href={`/notifications/${n.id}`}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <span className={`mt-0.5 inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${t.color}`}>
                    {t.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{n.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {n.publishedAt ? new Date(n.publishedAt).toLocaleDateString("ja-JP") : "—"}
                    </p>
                  </div>
                  <span className="text-gray-300 text-sm">›</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
''')

    write("src/app/(app)/notifications/[id]/page.tsx", '''\
// /notifications/[id] — お知らせ詳細
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"

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
    </div>
  )
}
''')

# ============================================================
# TASK J: /orders/[id]/pdf
# ============================================================
def task_j():
    print("\n[TASK J] /orders/[id]/pdf 実装")

    write("src/app/api/v1/orders/[id]/pdf/route.ts", '''\
// GET /api/v1/orders/[id]/pdf — 注文書PDF (HTML形式)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

interface Props { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Props) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const order = await prisma.order.findFirst({
    where: { id, customerId: session.user.customerId!, isDeleted: false },
    include: {
      estimateHeader: {
        include: { details: { where: { isDeleted: false }, orderBy: { rowNo: "asc" } } },
      },
    },
  })
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const est = order.estimateHeader
  const totalAmount = Number(order.totalAmount ?? est.details.reduce((s, d) => s + Number(d.totalPrice ?? 0), 0))
  const issueDate = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })

  const detailRows = est.details.map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${d.materialCode} ${d.materialName ?? ""}</td>
      <td>${d.kakouShiyou ?? ""}</td>
      <td class="right">${Number(d.sizeT)}</td>
      <td class="right">${Number(d.sizeA)}</td>
      <td class="right">${Number(d.sizeB)}</td>
      <td class="right">${d.quantity}</td>
      <td class="right">${d.unitPrice != null ? Number(d.unitPrice).toLocaleString() : "—"}</td>
      <td class="right">${d.totalPrice != null ? Number(d.totalPrice).toLocaleString() : "—"}</td>
      <td>${d.shortestDelivery ?? ""}</td>
    </tr>`).join("")

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>注文書 ${order.orderNo ?? ""}</title>
<style>
  @page { margin: 15mm; }
  * { box-sizing: border-box; }
  body { font-family: "Hiragino Kaku Gothic ProN","Meiryo",sans-serif; font-size: 11pt; color: #111; margin: 0; }
  h1 { text-align: center; font-size: 20pt; letter-spacing: 0.3em; border-bottom: 2px solid #1a2744; padding-bottom: 6px; margin-bottom: 16px; }
  .meta { text-align: right; margin-bottom: 12px; }
  .meta p { margin: 2px 0; font-size: 10pt; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .block { border: 1px solid #ccc; padding: 8px 12px; border-radius: 4px; }
  .block h3 { font-size: 9pt; color: #666; margin: 0 0 4px; }
  .block p { margin: 2px 0; font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th { background: #1a2744; color: #fff; padding: 5px 4px; text-align: center; }
  td { padding: 4px; border-bottom: 1px solid #e0e0e0; vertical-align: middle; }
  td.right { text-align: right; }
  tr:nth-child(even) td { background: #f8f9fb; }
  .total-row td { font-weight: bold; border-top: 2px solid #1a2744; padding: 6px 4px; }
  .footer { margin-top: 24px; font-size: 9pt; color: #666; border-top: 1px solid #ddd; padding-top: 8px; }
  .print-btn { position: fixed; top: 12px; right: 16px; padding: 8px 16px; background: #1a2744; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; }
  @media print { .print-btn { display: none; } }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨️ 印刷・PDF保存</button>
<h1>注 文 書</h1>
<div class="meta">
  <p>発行日：${issueDate}</p>
  <p>注文番号：<strong>${order.orderNo ?? "（採番待ち）"}</strong></p>
  <p>見積番号：${est.estimateNo ?? "—"}</p>
</div>
<div class="grid">
  <div class="block">
    <h3>注文者</h3>
    <p><strong>${est.customerName}</strong></p>
    <p>得意先コード：${est.customerCode}</p>
    ${est.customerOrderNo ? `<p>お客様注文番号：${est.customerOrderNo}</p>` : ""}
  </div>
  <div class="block">
    <h3>送り先</h3>
    ${est.destinationName ? `<p><strong>${est.destinationName}</strong></p>` : "<p>—</p>"}
    ${est.destinationDept ? `<p>${est.destinationDept}</p>` : ""}
    ${est.destinationZip ? `<p>〒${est.destinationZip}</p>` : ""}
    ${est.destinationAddress ? `<p>${est.destinationAddress}</p>` : ""}
    ${est.destinationTel ? `<p>TEL: ${est.destinationTel}</p>` : ""}
  </div>
</div>
<p style="text-align:center;margin:12px 0;font-size:11pt;">
  <strong>注文合計金額：¥${totalAmount.toLocaleString()}（税別）</strong>
</p>
<table>
  <thead>
    <tr>
      <th style="width:28px">No</th><th>材料</th><th>加工仕様</th>
      <th style="width:52px">T</th><th style="width:52px">A</th><th style="width:52px">B</th>
      <th style="width:40px">数量</th><th style="width:70px">単価(円)</th>
      <th style="width:80px">金額(円)</th><th style="width:80px">最短納期</th>
    </tr>
  </thead>
  <tbody>${detailRows}</tbody>
  <tfoot>
    <tr class="total-row">
      <td colspan="8" style="text-align:right">合計（税別）</td>
      <td class="right">¥${totalAmount.toLocaleString()}</td><td></td>
    </tr>
  </tfoot>
</table>
${est.remarks ? `<p style="margin-top:12px;font-size:10pt;"><strong>備考：</strong>${est.remarks}</p>` : ""}
<div class="footer">
  <p>越智製作所　TEL: 072-882-5524　E-mail: weborder@ochi-ss.co.jp</p>
</div>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  })
}
''')

# ============================================================
# TASK K: dashboard href修正 + orders/[id]に注文書PDFリンク追加
# ============================================================
def task_k():
    print("\n[TASK K] Dashboard href修正")
    replace_once(
        "src/app/(app)/dashboard/page.tsx",
        'href: "/delivery-destinations"',
        'href: "/masters/direct-delivery"',
        "dashboard delivery href修正"
    )

    # orders/[id] に注文書PDFリンク追加
    print("  [注文詳細ページに注文書PDFリンク追加]")
    replace_once(
        "src/app/(app)/orders/[id]/page.tsx",
        """          <Link
            href="/orders"
            className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
          >
            ← 注文一覧
          </Link>""",
        """          <Link
            href="/orders"
            className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
          >
            ← 注文一覧
          </Link>
          <Link
            href={`/api/v1/orders/${order.id}/pdf`}
            target="_blank"
            className="px-3 py-2 rounded-lg border border-emerald-300 text-emerald-700 text-sm hover:bg-emerald-50 transition-colors"
          >
            🖨️ 注文書PDF
          </Link>""",
        "注文書PDFリンク追加"
    )

    # estimates/[id]/edit ページにも見積書PDFリンク（あれば追加不要）確認
    # estimates page の見積書ボタンはすでに実装済みのためスキップ

# ============================================================
# メイン
# ============================================================
def main():
    print("=" * 60)
    print("fix_session11c.py 開始")
    print("=" * 60)

    task_g()
    task_h()
    task_i()
    task_j()
    task_k()

    print("\n" + "=" * 60)
    print("✅ 全ファイル作成完了 → tscチェック中...")
    result = subprocess.run(["npx", "tsc", "--noEmit"], capture_output=True, text=True, cwd=str(ROOT))
    if result.returncode != 0:
        print("❌ tscエラー:")
        print((result.stdout + result.stderr)[-5000:])
        sys.exit(1)

    print("✅ tscエラーなし → git add & push")
    subprocess.run(["git", "add", "-A"], check=True, cwd=str(ROOT))
    subprocess.run(["git", "commit", "-m",
        "feat: 注文確定フロー/直送先CRUD/お知らせ/注文書PDF/dashboard href修正 全実装"],
        check=True, cwd=str(ROOT))
    subprocess.run(["git", "push"], check=True, cwd=str(ROOT))
    print("✅ push完了")

if __name__ == "__main__":
    main()
