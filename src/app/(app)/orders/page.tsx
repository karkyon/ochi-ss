import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import OrdersClient from "./OrdersClient"

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const sp = await searchParams
  const customerId = (session.user as any).customerId ?? ""
  const page    = Math.max(1, parseInt(sp.page ?? "1"))
  const perPage = 20
  const where: any = { customerId, isDeleted: false }
  if (sp.dateFrom) where.orderDate = { gte: new Date(sp.dateFrom) }
  if (sp.dateTo)   where.orderDate = { ...where.orderDate, lte: new Date(sp.dateTo + "T23:59:59") }
  if (sp.orderNo)  where.customerOrderNo = { contains: sp.orderNo }
  if (sp.status)   where.orderStatus = sp.status

  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where, orderBy: { orderDate: "desc" },
      skip: (page - 1) * perPage, take: perPage,
      select: { id: true, orderNo: true, orderDate: true, estimateId: true, destinationName: true, orderStatus: true, details: { select: { totalPrice: true } } },
    }),
  ])
  const estimates = await prisma.estimate.findMany({ where: { id: { in: rows.map(r => r.estimateId ?? "").filter(Boolean) } }, select: { id: true, estimateNo: true } })
  const estMap = Object.fromEntries(estimates.map(e => [e.id, e.estimateNo ?? ""]))

  const orders = rows.map(r => ({
    id: r.id, orderNo: r.orderNo ?? "—",
    orderDate: r.orderDate?.toISOString().slice(0, 10) ?? "",
    estimateNo: r.estimateId ? estMap[r.estimateId] ?? "" : "",
    destinationName: r.destinationName ?? "—",
    totalAmount: r.details.reduce((s, d) => s + Number(d.totalPrice ?? 0), 0),
    status: r.orderStatus ?? "processing",
  }))

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <div style={{ fontSize: "14px", fontWeight: 600, borderLeft: "3px solid #1d4ed8", paddingLeft: "8px" }}>ご注文履歴検索</div>
        <Link href="/dashboard" className="btn-ochi btn-outline" style={{ fontSize: "11px" }}>← メインメニュー</Link>
      </div>
      <OrdersClient defaultValues={sp} orders={orders} total={total} page={page} totalPages={Math.max(1, Math.ceil(total / perPage))} />
    </div>
  )
}
