// src/app/(app)/orders/[id]/page.tsx
// 注文詳細ページ (Server Component)

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:     { label: "処理中",   color: "bg-yellow-100 text-yellow-700" },
  confirmed:   { label: "確定",     color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "製造中",   color: "bg-purple-100 text-purple-700" },
  shipped:     { label: "出荷済",   color: "bg-teal-100 text-teal-700" },
  completed:   { label: "完了",     color: "bg-green-100 text-green-700" },
  cancelled:   { label: "取消",     color: "bg-red-100 text-red-600" },
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function OrderDetailPage({ params }: Props) {
  const session = await auth()
  const { id } = await params

  const order = await prisma.order.findFirst({
    where: {
      id,
      customerId: session!.user.customerId!,
      isDeleted: false,
    },
    include: {
      estimateHeader: {
        include: {
          details: {
            where: { isDeleted: false },
            orderBy: { rowNo: "asc" },
          },
        },
      },
      statusHistories: {
        orderBy: { occurredAt: "asc" },
      },
    },
  })

  if (!order) notFound()

  const est = order.estimateHeader
  const totalAmount = Number(order.totalAmount ?? 0)
  const st = STATUS_LABEL[order.orderStatus] ?? { label: order.orderStatus, color: "bg-gray-100 text-gray-600" }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-[#1a2744]" />
          <h1 className="font-bold text-gray-800 text-lg">
            注文詳細
            {order.orderNo && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                （注文No: {order.orderNo}）
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/orders"
            className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
          >
            ← 注文一覧
          </Link>
          <Link
            href="/dashboard"
            className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
          >
            メインメニュー
          </Link>
        </div>
      </div>

      {/* 注文ヘッダー情報 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">注文情報</p>
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${st.color}`}>
            {st.label}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-[10px] text-gray-400 mb-0.5">注文No</p>
            <p className="font-medium text-gray-800">{order.orderNo ?? "（採番待ち）"}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 mb-0.5">注文日付</p>
            <p className="font-medium text-gray-800">
              {order.orderDate.toLocaleDateString("ja-JP")}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 mb-0.5">見積No</p>
            <p className="font-medium text-gray-800">{est.estimateNo ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 mb-0.5">得意先コード</p>
            <p className="font-medium text-gray-800">{est.customerCode}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 mb-0.5">得意先名</p>
            <p className="font-medium text-gray-800">{est.customerName}</p>
          </div>
          {est.customerOrderNo && (
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">お客様注文番号</p>
              <p className="font-medium text-gray-800">{est.customerOrderNo}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] text-gray-400 mb-0.5">合計金額（税別）</p>
            <p className="font-bold text-gray-800 text-base">
              {totalAmount > 0 ? `¥${totalAmount.toLocaleString()}` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 mb-0.5">明細件数</p>
            <p className="font-medium text-gray-800">{order.detailCount ?? est.details.length}件</p>
          </div>
          {order.trackingNo && (
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">送り状番号</p>
              <p className="font-medium text-gray-800">{order.trackingNo}</p>
            </div>
          )}
        </div>
      </div>

      {/* 送り先情報 */}
      {est.destinationName && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">送り先情報</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            {est.destinationCode && (
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">送り先コード</p>
                <p className="font-medium text-gray-800">{est.destinationCode}</p>
              </div>
            )}
            <div className="lg:col-span-2">
              <p className="text-[10px] text-gray-400 mb-0.5">送り先名称</p>
              <p className="font-medium text-gray-800">{est.destinationName}</p>
            </div>
            {est.destinationDept && (
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">部署名</p>
                <p className="font-medium text-gray-800">{est.destinationDept}</p>
              </div>
            )}
            {est.destinationPerson && (
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">担当者名</p>
                <p className="font-medium text-gray-800">{est.destinationPerson}</p>
              </div>
            )}
            {est.destinationZip && (
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">郵便番号</p>
                <p className="font-medium text-gray-800">〒{est.destinationZip}</p>
              </div>
            )}
            {est.destinationAddress && (
              <div className="lg:col-span-2">
                <p className="text-[10px] text-gray-400 mb-0.5">住所</p>
                <p className="font-medium text-gray-800">{est.destinationAddress}</p>
              </div>
            )}
            {est.destinationTel && (
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">TEL</p>
                <p className="font-medium text-gray-800">{est.destinationTel}</p>
              </div>
            )}
            {est.destinationFax && (
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">FAX</p>
                <p className="font-medium text-gray-800">{est.destinationFax}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 明細テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">注文明細</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 w-10">No</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">材料</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">加工仕様</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">T(mm)</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">A(mm)</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">B(mm)</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">数量</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">単価(円)</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">金額(円)</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">最短納期</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {est.details.map((d, i) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3 text-center text-gray-500">{i + 1}</td>
                  <td className="px-3 py-3 text-gray-700">
                    <span className="font-medium">{d.materialCode}</span>
                    {d.materialName && <span className="text-gray-400 text-xs ml-1">{d.materialName}</span>}
                  </td>
                  <td className="px-3 py-3 text-gray-700">{d.kakouShiyou ?? "—"}</td>
                  <td className="px-3 py-3 text-right text-gray-700">{Number(d.sizeT)}</td>
                  <td className="px-3 py-3 text-right text-gray-700">{Number(d.sizeA)}</td>
                  <td className="px-3 py-3 text-right text-gray-700">{Number(d.sizeB)}</td>
                  <td className="px-3 py-3 text-right text-gray-700">{d.quantity}</td>
                  <td className="px-3 py-3 text-right text-gray-700">
                    {d.unitPrice != null ? `¥${Number(d.unitPrice).toLocaleString()}` : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-gray-800">
                    {d.totalPrice != null ? `¥${Number(d.totalPrice).toLocaleString()}` : "—"}
                  </td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{d.shortestDelivery ?? "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td colSpan={8} className="px-3 py-3 text-right font-semibold text-gray-700">
                  合計（税別）
                </td>
                <td className="px-3 py-3 text-right font-bold text-gray-800">
                  {totalAmount > 0 ? `¥${totalAmount.toLocaleString()}` : "—"}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ステータス履歴 */}
      {order.statusHistories.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">ステータス変更履歴</p>
          <div className="space-y-2">
            {order.statusHistories.map(h => {
              const toSt = STATUS_LABEL[h.toStatus] ?? { label: h.toStatus, color: "bg-gray-100 text-gray-600" }
              return (
                <div key={h.id} className="flex items-center gap-3 text-sm">
                  <span className="text-gray-400 text-xs whitespace-nowrap">
                    {h.occurredAt.toLocaleDateString("ja-JP")}
                  </span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${toSt.color}`}>
                    {toSt.label}
                  </span>
                  {h.changeReason && (
                    <span className="text-gray-500 text-xs">{h.changeReason}</span>
                  )}
                  {h.trackingNo && (
                    <span className="text-gray-500 text-xs">送り状: {h.trackingNo}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 備考 */}
      {est.remarks && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">備考</p>
          <p className="text-sm text-gray-700">{est.remarks}</p>
        </div>
      )}

      {/* お問い合わせ */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-800">
        <p className="font-semibold mb-1">ご不明な点はお問い合わせください</p>
        <p>越智製作所　TEL: 072-882-5524　E-mail: weborder@ochi-ss.co.jp</p>
      </div>
    </div>
  )
}
