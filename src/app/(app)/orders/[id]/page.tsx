// src/app/(app)/orders/[id]/page.tsx
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import OrderCancelButton from "./OrderCancelButton"

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:     { label: "処理中",   color: "bg-yellow-100 text-yellow-700" },
  confirmed:   { label: "確定",     color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "製造中",   color: "bg-purple-100 text-purple-700" },
  shipped:     { label: "出荷済",   color: "bg-teal-100 text-teal-700" },
  completed:   { label: "完了",     color: "bg-green-100 text-green-700" },
  cancelled:   { label: "取消",     color: "bg-red-100 text-red-600" },
}

const STATUS_HIST_LABEL: Record<string, string> = {
  pending: "処理中", confirmed: "確定", in_progress: "製造中",
  shipped: "出荷済", completed: "完了", cancelled: "取消",
}

interface Props { params: Promise<{ id: string }> }

export default async function OrderDetailPage({ params }: Props) {
  const session = await auth()
  const { id } = await params

  const order = await (prisma as any).order.findFirst({
    where: { id, customerId: session!.user.customerId!, isDeleted: false },
    include: {
      estimateHeader: {
        include: {
          details: { where: { isDeleted: false }, orderBy: { rowNo: "asc" } },
        },
      },
      statusHistories: { orderBy: { occurredAt: "asc" } },
      // ★2026/07/13 修正: Prismaスキーマ上の実際のリレーション名は specChanges
      // (specChangeHistories という名前のフィールドは存在せず
      //  PrismaClientValidationErrorの原因になっていた)
      specChanges:     { orderBy: { occurredAt: "asc" } },
    },
  })

  if (!order) notFound()

  const est         = order.estimateHeader
  const totalAmount = Number(order.totalAmount ?? 0)
  const st          = STATUS_LABEL[order.orderStatus] ?? { label: order.orderStatus, color: "bg-gray-100 text-gray-600" }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-[#1a2744]" />
          <h1 className="font-bold text-gray-800 text-lg">
            注文詳細
            {order.orderNo && <span className="ml-2 text-sm font-normal text-gray-500">（注文No: {order.orderNo}）</span>}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/orders" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50">← 注文一覧</Link>
          <Link href={`/api/v1/orders/${order.id}/pdf`} target="_blank" className="px-3 py-2 rounded-lg border border-emerald-300 text-emerald-700 text-sm hover:bg-emerald-50">🖨️ 注文書PDF</Link>
          {["pending", "confirmed"].includes(order.orderStatus) && (
            <OrderCancelButton orderId={order.id} orderNo={order.orderNo ?? order.id.slice(0, 8)} />
          )}
          <Link href="/dashboard" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50">メインメニュー</Link>
        </div>
      </div>

      {/* 注文ヘッダー情報 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">注文情報</p>
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          {[
            { label: "注文No",           val: order.orderNo ?? "（採番待ち）" },
            { label: "注文日付",         val: new Date(order.orderDate).toLocaleDateString("ja-JP") },
            { label: "見積No",           val: est.estimateNo ?? "—" },
            { label: "得意先コード",     val: est.customerCode },
            { label: "得意先名",         val: est.customerName },
            ...(est.customerOrderNo ? [{ label: "お客様注文番号", val: est.customerOrderNo }] : []),
            { label: "合計金額（税別）", val: totalAmount > 0 ? `¥${totalAmount.toLocaleString()}` : "—" },
            { label: "明細件数",         val: `${order.detailCount ?? est.details.length}件` },
            ...(order.trackingNo ? [{ label: "送り状番号", val: order.trackingNo }] : []),
          ].map(({ label, val }) => (
            <div key={label}>
              <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
              <p className="font-medium text-gray-800">{val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 送り先情報 */}
      {est.destinationName && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">送り先情報</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            {[
              { label: "送り先コード", val: est.destinationCode },
              { label: "送り先名称",   val: est.destinationName, span: 2 },
              { label: "部署名",       val: est.destinationDept },
              { label: "担当者名",     val: est.destinationPerson },
              { label: "郵便番号",     val: est.destinationZip ? `〒${est.destinationZip}` : null },
              { label: "住所",         val: est.destinationAddress, span: 2 },
              { label: "TEL",          val: est.destinationTel },
              { label: "FAX",          val: est.destinationFax },
            ].filter(f => f.val).map(({ label, val, span }) => (
              <div key={label} className={span === 2 ? "lg:col-span-2" : ""}>
                <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                <p className="font-medium text-gray-800">{val}</p>
              </div>
            ))}
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
                {["No","材料","加工仕様","T(mm)","A(mm)","B(mm)","数量","単価(円)","金額(円)","最短納期"].map(h => (
                  <th key={h} className="px-3 py-3 text-xs font-semibold text-gray-500 text-right first:text-center last:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {est.details.map((d: any, i: number) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3 text-center text-gray-500">{i + 1}</td>
                  <td className="px-3 py-3 text-gray-700">
                    <span className="font-medium">{d.materialCode}</span>
                    {d.materialName && <span className="text-gray-400 text-xs ml-1">{d.materialName}</span>}
                  </td>
                  <td className="px-3 py-3 text-gray-700">{d.kakouShiyou ?? "—"}</td>
                  <td className="px-3 py-3 text-right">{Number(d.sizeT)}</td>
                  <td className="px-3 py-3 text-right">{Number(d.sizeA)}</td>
                  <td className="px-3 py-3 text-right">{Number(d.sizeB)}</td>
                  <td className="px-3 py-3 text-right">{d.quantity}</td>
                  <td className="px-3 py-3 text-right">{d.unitPrice != null ? `¥${Number(d.unitPrice).toLocaleString()}` : "—"}</td>
                  <td className="px-3 py-3 text-right font-medium">{d.totalPrice != null ? `¥${Number(d.totalPrice).toLocaleString()}` : "—"}</td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{d.shortestDelivery ?? "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td colSpan={8} className="px-3 py-3 text-right font-semibold text-gray-700">合計（税別）</td>
                <td className="px-3 py-3 text-right font-bold">{totalAmount > 0 ? `¥${totalAmount.toLocaleString()}` : "—"}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ステータス履歴 */}
      {order.statusHistories?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">ステータス変更履歴</p>
          <div className="space-y-2">
            {order.statusHistories.map((h: any) => {
              const toSt = STATUS_LABEL[h.toStatus] ?? { label: h.toStatus, color: "bg-gray-100 text-gray-600" }
              return (
                <div key={h.id} className="flex items-center gap-3 text-sm">
                  <span className="text-gray-400 text-xs whitespace-nowrap">{new Date(h.occurredAt).toLocaleDateString("ja-JP")}</span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${toSt.color}`}>{toSt.label}</span>
                  {h.changeReason && <span className="text-gray-500 text-xs">{h.changeReason}</span>}
                  {h.trackingNo && <span className="text-gray-500 text-xs">送り状: {h.trackingNo}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 仕様変更履歴 */}
      {order.specChanges?.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-5 mb-4">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-4">⚠️ 仕様変更履歴</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-amber-50 border-b border-amber-200">
                <tr>
                  {["行No","変更フィールド","変更前","変更後","変更理由","変更日時"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-medium text-amber-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {order.specChanges.map((h: any) => (
                  <tr key={h.id} className="hover:bg-amber-50/50">
                    <td className="px-3 py-2 text-center">{h.rowNo}</td>
                    <td className="px-3 py-2 font-mono">{h.fieldName}</td>
                    <td className="px-3 py-2 text-gray-400 line-through">{h.oldValue ?? "—"}</td>
                    <td className="px-3 py-2 font-medium text-amber-700">{h.newValue}</td>
                    <td className="px-3 py-2 text-gray-600">{h.changeReason ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                      {h.occurredAt ? new Date(h.occurredAt).toLocaleDateString("ja-JP") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
