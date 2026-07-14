import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import EstimateNewClient from "../../new/EstimateNewClient"

export default async function EstimateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const { id } = await params

  const customerId   = (session.user as any).customerId  ?? ""
  const customerCode = (session.user as any).companyCode ?? (session.user as any).customerCode ?? ""
  const userName     = (session.user as any).chargeName  ?? (session.user as any).userName     ?? ""
  const companyName  = (session.user as any).customerName ?? (session.user as any).companyName  ?? ""

  const [materials, processingSpecs] = await Promise.all([
    prisma.material.findMany({
      orderBy: { materialCode: "asc" },
      select: { materialCode: true, materialName: true },
    }),
    prisma.processingSpec.findMany({
      orderBy: { processingSpecCode: "asc" },
      select: { processingSpecCode: true, processingSpecName: true },
    }),
  ])

  const estimate = await prisma.estimateHeader.findFirst({
    where: { id, customerId, isDeleted: false },
    include: { details: { where: { isDeleted: false }, orderBy: { rowNo: "asc" } } },
  })
  if (!estimate) redirect("/estimates")

  // 2026/07/13 追加: 見積が既に注文済み(estimateStatus==="ordered")の場合、
  // 明細一覧に「注文済」バッジ・注文Noを表示しチェックボックスを無効化するため、
  // 紐づく注文(Order)を取得する。受注は見積単位で1:1(estimateHeaderId unique)のため、
  // 見積が注文済みならその見積の全明細が注文済み扱いとなる。
  const relatedOrder = estimate.estimateStatus === "ordered"
    ? await prisma.order.findFirst({ where: { estimateHeaderId: estimate.id }, select: { orderNo: true } })
    : null

  const copySource = {
    estimateId:    estimate.id,
    estimateNo:    estimate.estimateNo ?? "",
    destinationCode:    estimate.destinationCode    ?? "",
    destinationName:    estimate.destinationName    ?? "",
    destinationDept:    estimate.destinationDept    ?? "",
    destinationPerson:  estimate.destinationPerson  ?? "",
    destinationZip:     estimate.destinationZip     ?? "",
    destinationAddress: estimate.destinationAddress ?? "",
    destinationTel:     estimate.destinationTel     ?? "",
    destinationFax:     estimate.destinationFax     ?? "",
    contact:        estimate.remarks        ?? "",   // contact→remarks にマッピング
    customerOrderNo: estimate.customerOrderNo ?? "",
    endUserNo:       estimate.endUserNo       ?? "",
    shippingMethod:  String(estimate.shippingMethodId ?? 1),
    details: estimate.details.map(d => ({
      clientDetailId:   d.id,
      materialCode:     d.materialCode     ?? "",
      kakouShiyouCode:  d.kakouShiyouCode  ?? 0,
      kakouT:           d.kakouT           ?? "",
      kakouB:           d.kakouB           ?? "",
      kakouA:           d.kakouA           ?? "",
      shiagari:         d.kakouShiyou      ?? "",
      sizeT:  Number(d.sizeT  ?? 0),
      sizeB:  Number(d.sizeB  ?? 0),
      sizeA:  Number(d.sizeA  ?? 0),
      toleranceTUp:   Number(d.kousaTUpper ?? 0),
      toleranceTDown: Number(d.kousaTLower ?? 0),
      toleranceBUp:   Number(d.kousaBUpper ?? 0),
      toleranceBDown: Number(d.kousaBLower ?? 0),
      toleranceAUp:   Number(d.kousaAUpper ?? 0),
      toleranceADown: Number(d.kousaALower ?? 0),
      mentoriShiji:  d.mentoriShiji ? parseInt(d.mentoriShiji) : 9,
      mentori4:  Number(d.mentori4 ?? 0),
      mentori8:  Number(d.mentori8 ?? 0),
      quantity:  d.quantity ?? 1,
      customerDetailOrderNo:    (d as any).customerDetailOrderNo    ?? "",
      destinationDetailOrderNo: (d as any).destinationDetailOrderNo ?? "",
      remarks:   (d as any).remarks ?? "",
      useIndividualDestination: (d as any).useIndividualDestination ?? false,
            destinationCode:    (d as any).destinationCode    ?? "",
            destinationName:    (d as any).destinationName    ?? "",
            destinationDept:    (d as any).destinationDept    ?? "",
            destinationPerson:  (d as any).destinationPerson  ?? "",
            destinationZip:     (d as any).destinationZip     ?? "",
            destinationAddress: (d as any).destinationAddress ?? "",
            destinationTel:     (d as any).destinationTel     ?? "",
            destinationFax:     (d as any).destinationFax     ?? "",
      unitPrice:  Number(d.unitPrice  ?? 0),
      totalPrice: Number(d.totalPrice ?? 0),
      deliveryDate:     d.shortestDelivery ?? undefined,
      fastDeliveryDate: d.shortestDelivery ?? undefined,
      deliveryDeadline: d.deliveryDeadline
        ? d.deliveryDeadline.toISOString()
        : null,
      // 2026/07/13 追加: 見積が注文済みなら全明細を注文済み扱いにし、
      // チェックボックスを無効化して「注文済」+注文Noを表示する
      isOrdered: estimate.estimateStatus === "ordered",
      orderedOrderNo: relatedOrder?.orderNo ?? undefined,
      calculated: true,
    })),
  }

  return (
    <EstimateNewClient
      materials={materials.map(m => ({ materialCode: m.materialCode, materialName: m.materialName ?? "" }))}
      processingSpecs={processingSpecs.map(s => ({ processingSpecCode: s.processingSpecCode, processingSpecName: s.processingSpecName ?? "", kakouShijiT: (s as any).kakouShijiT ?? "W", kakouShijiA: (s as any).kakouShijiA ?? "W", kakouShijiB: (s as any).kakouShijiB ?? "W" }))}
      cuttingMethods={[]}
      userInfo={{ customerId, customerCode, userName, companyName }}
      copySource={copySource}
      isCopy={false}
    />
  )
}
