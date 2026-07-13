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
      unitPrice:  Number(d.unitPrice  ?? 0),
      totalPrice: Number(d.totalPrice ?? 0),
      deliveryDate:     d.shortestDelivery ?? undefined,
      // ★2026/07/13 追加修正: EstimateNewClient.tsx の登録済み明細一覧「納期」列は
      // deliveryDate ではなく fastDeliveryDate を参照している
      // ({fmt(d.fastDeliveryDate)})。この行が無いと納期保証期限は表示されるのに
      // 肝心の最短納期だけ常に空欄になる。/estimates/new/page.tsx と同じ形式に統一。
      fastDeliveryDate: d.shortestDelivery ?? undefined,
      // ★2026/07/13 修正: .slice(0, 10)で日付のみに切り詰めると時刻(17:30等)が
      // 失われ、EstimateNewClient側のisExpired()判定で「すでに期限切れ」と
      // 誤判定される致命的バグがあった。/estimates/new/page.tsx と同様に
      // フルISO文字列(時刻付き)のまま渡すよう修正。
      deliveryDeadline: d.deliveryDeadline
        ? d.deliveryDeadline.toISOString()
        : null,
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
