import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import EstimateNewClient from "../../new/EstimateNewClient"

export default async function EstimateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const { id } = await params

  const customerId   = (session.user as any).customerId   ?? ""
  const customerCode = (session.user as any).customerCode ?? ""
  const userName     = (session.user as any).userName     ?? ""
  const companyName  = (session.user as any).companyName  ?? ""

  const [materials, processingSpecs, cuttingMethods] = await Promise.all([
    prisma.material.findMany({ where: { isActive: true }, orderBy: { materialCode: "asc" }, select: { materialCode: true, materialName: true } }),
    prisma.processingSpec.findMany({ orderBy: { processingSpecCode: "asc" }, select: { processingSpecCode: true, processingSpecName: true } }),
    prisma.cuttingMethod.findMany({ where: { customerCode }, orderBy: { sortOrder: "asc" }, select: { methodCode: true, methodName: true } }),
  ])

  const estimate = await prisma.estimate.findFirst({
    where: { id, customerId, isDeleted: false },
    include: { details: { where: { isDeleted: false }, orderBy: { rowNo: "asc" } } },
  })
  if (!estimate) redirect("/estimates")

  const copySource = {
    estimateId: estimate.id,
    estimateNo: estimate.estimateNo ?? "",
    destinationCode: estimate.destinationCode ?? "",
    destinationName: estimate.destinationName ?? "",
    destinationDept: estimate.destinationDept ?? "",
    destinationPerson: estimate.destinationPerson ?? "",
    destinationZip: estimate.destinationZip ?? "",
    destinationAddress: estimate.destinationAddress ?? "",
    destinationTel: estimate.destinationTel ?? "",
    destinationFax: estimate.destinationFax ?? "",
    contact: estimate.contact ?? "",
    customerOrderNo: estimate.customerOrderNo ?? "",
    endUserNo: estimate.endUserNo ?? "",
    shippingMethod: (estimate as any).shippingMethod ?? "delivery",
    details: estimate.details.map(d => ({
      clientDetailId: d.id,
      materialCode: (d as any).materialCode ?? "",
      kakouShiyouCode: (d as any).kakouShiyouCode ?? 0,
      kakouT: (d as any).kakouT ?? "", kakouB: (d as any).kakouB ?? "", kakouA: (d as any).kakouA ?? "",
      shiagari: (d as any).shiagari ?? "",
      sizeT: Number(d.sizeT ?? 0), sizeB: Number(d.sizeB ?? 0), sizeA: Number(d.sizeA ?? 0),
      toleranceTUp: Number((d as any).toleranceTUp ?? 0), toleranceTDown: Number((d as any).toleranceTDown ?? 0),
      toleranceBUp: Number((d as any).toleranceBUp ?? 0), toleranceBDown: Number((d as any).toleranceBDown ?? 0),
      toleranceAUp: Number((d as any).toleranceAUp ?? 0), toleranceADown: Number((d as any).toleranceADown ?? 0),
      mentoriShiji: Number((d as any).mentoriShiji ?? 9), mentori4: Number((d as any).mentori4 ?? 0), mentori8: Number((d as any).mentori8 ?? 0),
      quantity: Number(d.quantity ?? 1),
      customerDetailOrderNo: (d as any).customerDetailOrderNo ?? "",
      destinationDetailOrderNo: (d as any).destinationDetailOrderNo ?? "",
      remarks: (d as any).remarks ?? "",
      unitPrice: Number((d as any).unitPrice ?? 0),
      totalPrice: Number(d.totalPrice ?? 0),
      deliveryDate: (d as any).deliveryDate ? String((d as any).deliveryDate).slice(0, 10) : undefined,
      deliveryDeadline: d.deliveryDeadline ? d.deliveryDeadline.toISOString().slice(0, 10) : null,
      calculated: true,
    }))
  }

  return (
    <EstimateNewClient
      materials={materials.map(m => ({ materialCode: m.materialCode, materialName: m.materialName ?? "" }))}
      processingSpecs={processingSpecs.map(s => ({ processingSpecCode: s.processingSpecCode, processingSpecName: s.processingSpecName ?? "" }))}
      cuttingMethods={cuttingMethods.map(c => ({ methodCode: c.methodCode, methodName: c.methodName ?? "" }))}
      userInfo={{ customerId, customerCode, userName, companyName }}
      copySource={copySource}
      isCopy={false}
    />
  )
}
