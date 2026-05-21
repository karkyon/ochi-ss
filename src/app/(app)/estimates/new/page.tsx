import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import EstimateNewClient from "./EstimateNewClient"

export default async function EstimateNewPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const sp = await searchParams

  const customerId   = (session.user as any).customerId   ?? ""
  const customerCode = (session.user as any).customerCode ?? ""
  const userName     = (session.user as any).userName     ?? (session.user as any).chargeName ?? ""
  const companyName  = (session.user as any).companyName  ?? (session.user as any).customerName ?? ""

  const [materials, processingSpecs] = await Promise.all([
    // Material に isActive フィールドは存在しない
    prisma.material.findMany({ orderBy: { materialCode: "asc" }, select: { materialCode: true, materialName: true } }),
    prisma.processingSpec.findMany({ orderBy: { processingSpecCode: "asc" }, select: { processingSpecCode: true, processingSpecName: true } }),
  ])

  // cuttingMethod はクライアント側でAPIから取得
  const cuttingMethods: Array<{ methodCode: string; methodName: string }> = []

  let copySourceData: any = null
  if (sp.copyFrom) {
    try {
      const src = await prisma.estimateHeader.findFirst({
        where: { id: sp.copyFrom, customerId, isDeleted: false },
        include: { details: { where: { isDeleted: false }, orderBy: { rowNo: "asc" } } },
      })
      if (src) {
        copySourceData = {
          estimateId: src.id,
          destinationCode: src.destinationCode ?? "",
          destinationName: src.destinationName ?? "",
          destinationDept: (src as any).destinationDept ?? "",
          destinationPerson: (src as any).destinationPerson ?? "",
          destinationZip: (src as any).destinationZip ?? "",
          destinationAddress: src.destinationAddress ?? "",
          destinationTel: src.destinationTel ?? "",
          destinationFax: src.destinationFax ?? "",
          contact: src.contact ?? "",
          customerOrderNo: src.customerOrderNo ?? "",
          endUserNo: src.endUserNo ?? "",
          shippingMethod: (src as any).shippingMethod ?? "delivery",
          details: src.details.map(d => ({
            clientDetailId: d.id,
            materialCode: d.materialCode ?? "",
            kakouShiyouCode: d.kakouShiyouCode ?? 0,
            kakouT: d.kakouT ?? "", kakouB: d.kakouB ?? "", kakouA: d.kakouA ?? "",
            shiagari: (d as any).shiagari ?? "",
            sizeT: Number(d.sizeT ?? 0), sizeB: Number(d.sizeB ?? 0), sizeA: Number(d.sizeA ?? 0),
            toleranceTUp:   Number(d.kousaTUpper ?? 0), toleranceTDown: Number(d.kousaTLower ?? 0),
            toleranceBUp:   Number(d.kousaBUpper ?? 0), toleranceBDown: Number(d.kousaBLower ?? 0),
            toleranceAUp:   Number(d.kousaAUpper ?? 0), toleranceADown: Number(d.kousaALower ?? 0),
            mentoriShiji: d.mentoriShiji ? parseInt(d.mentoriShiji) : 9,
            mentori4: Number(d.mentori4 ?? 0), mentori8: Number(d.mentori8 ?? 0),
            quantity: d.quantity ?? 1,
            customerDetailOrderNo: (d as any).customerOrderNo ?? "",
            destinationDetailOrderNo: (d as any).destinationOrderNo ?? "",
            remarks: (d as any).remarks ?? "",
            deliveryDeadline: d.deliveryDeadline ? d.deliveryDeadline.toISOString().slice(0, 10) : null,
          }))
        }
      }
    } catch { /* サイレント */ }
  }

  return (
    <EstimateNewClient
      materials={materials.map(m => ({ materialCode: m.materialCode, materialName: m.materialName ?? "" }))}
      processingSpecs={processingSpecs.map(s => ({ processingSpecCode: s.processingSpecCode, processingSpecName: s.processingSpecName ?? "" }))}
      cuttingMethods={cuttingMethods}
      userInfo={{ customerId, customerCode, userName, companyName }}
      copySource={copySourceData}
      isCopy={!!sp.copyFrom}
    />
  )
}
