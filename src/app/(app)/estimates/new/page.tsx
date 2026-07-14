import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import EstimateNewClient from "./EstimateNewClient"

export default async function EstimateNewPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const sp = await searchParams

  const customerId   = (session.user as any).customerId   ?? ""
  const customerCode = (session.user as any).companyCode  ?? (session.user as any).customerCode ?? ""
  const userName     = (session.user as any).chargeName   ?? (session.user as any).userName     ?? ""
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

  let copySourceData: any = null
  if (sp.copyFrom) {
    try {
      const src = await prisma.estimateHeader.findFirst({
        where: { id: sp.copyFrom, customerId, isDeleted: false },
        include: { details: { where: { isDeleted: false }, orderBy: { rowNo: "asc" } } },
      })
      if (src) {
        copySourceData = {
          estimateId:         src.id,
          destinationCode:    src.destinationCode    ?? "",
          destinationName:    src.destinationName    ?? "",
          destinationDept:    src.destinationDept    ?? "",
          destinationPerson:  src.destinationPerson  ?? "",
          destinationZip:     src.destinationZip     ?? "",
          destinationAddress: src.destinationAddress ?? "",
          destinationTel:     src.destinationTel     ?? "",
          destinationFax:     src.destinationFax     ?? "",
          contact:         src.remarks        ?? "",
          customerOrderNo: src.customerOrderNo ?? "",
          endUserNo:       src.endUserNo       ?? "",
          shippingMethod:  String(src.shippingMethodId ?? 1),
          details: src.details.map(d => ({
            clientDetailId:   d.id,
            materialCode:     d.materialCode    ?? "",
            kakouShiyouCode:  d.kakouShiyouCode ?? 0,
            kakouT: d.kakouT ?? "", kakouB: d.kakouB ?? "", kakouA: d.kakouA ?? "",
            shiagari: d.kakouShiyou ?? "",
            sizeT: Number(d.sizeT ?? 0), sizeB: Number(d.sizeB ?? 0), sizeA: Number(d.sizeA ?? 0),
            toleranceTUp:   Number(d.kousaTUpper ?? 0), toleranceTDown: Number(d.kousaTLower ?? 0),
            toleranceBUp:   Number(d.kousaBUpper ?? 0), toleranceBDown: Number(d.kousaBLower ?? 0),
            toleranceAUp:   Number(d.kousaAUpper ?? 0), toleranceADown: Number(d.kousaALower ?? 0),
            mentoriShiji: d.mentoriShiji ? parseInt(d.mentoriShiji) : 9,
            mentori4: Number(d.mentori4 ?? 0), mentori8: Number(d.mentori8 ?? 0),
            quantity: d.quantity ?? 1,
            customerDetailOrderNo:    (d as any).customerDetailOrderNo    ?? "",
            destinationDetailOrderNo: (d as any).destinationDetailOrderNo ?? "",
            remarks: (d as any).remarks ?? "",
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
            deliveryDate: d.shortestDelivery ?? undefined,
            fastDeliveryDate: d.shortestDelivery ?? undefined,
            // deliveryDeadlineは日時フルで渡す（fmtDtで表示するため）
            deliveryDeadline: d.deliveryDeadline
              ? d.deliveryDeadline.toISOString()
              : null,
            fastDeliveryDeadline: d.deliveryDeadline
              ? d.deliveryDeadline.toISOString()
              : undefined,
          })),
        }
      }
    } catch { /* サイレント */ }
  }

  return (
    <EstimateNewClient
      materials={materials.map(m => ({ materialCode: m.materialCode, materialName: m.materialName ?? "" }))}
      processingSpecs={processingSpecs.map(s => ({ processingSpecCode: s.processingSpecCode, processingSpecName: s.processingSpecName ?? "", kakouShijiT: (s as any).kakouShijiT ?? "W", kakouShijiA: (s as any).kakouShijiA ?? "W", kakouShijiB: (s as any).kakouShijiB ?? "W" }))}
      cuttingMethods={[]}
      userInfo={{ customerId, customerCode, userName, companyName }}
      copySource={copySourceData}
      isCopy={!!sp.copyFrom}
    />
  )
}
