// src/app/(app)/estimates/[id]/edit/page.tsx
// STEP 14: 見積編集ページ（保存後のリダイレクト先）

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import EstimateEditClient from "./EstimateEditClient"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EstimateEditPage({ params }: Props) {
  const session = await auth()
  const { id } = await params

  // ── DB から見積データ取得 ──
  const estimate = await prisma.estimateHeader.findFirst({
    where: {
      id,
      customerId: session!.user.customerId!,
      isDeleted: false,
    },
    include: {
      details: {
        where: { isDeleted: false },
        orderBy: { rowNo: "asc" },
      },
    },
  })

  if (!estimate) notFound()

  // 注文済みは編集不可 → 一覧へ
  if (estimate.estimateStatus === "ordered") {
    redirect("/estimates")
  }

  // マスタデータ取得
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

  const userInfo = {
    customerCode: session!.user.companyCode ?? "",
    customerName: session!.user.customerName ?? "",
    chargeName:   session!.user.chargeName ?? "",
    userId:       session!.user.userId ?? "",
  }

  // Prisma の Decimal を number に変換してクライアントに渡す
  const estimateData = {
    id:               estimate.id,
    estimateNo:       estimate.estimateNo ?? "",
    estimateStatus:   estimate.estimateStatus,
    inputDate:        estimate.inputDate.toISOString().slice(0, 10),
    customerOrderNo:  estimate.customerOrderNo ?? "",
    endUserNo:        estimate.endUserNo ?? "",
    destinationCode:  estimate.destinationCode ?? "",
    destinationName:  estimate.destinationName ?? "",
    destinationDept:  estimate.destinationDept ?? "",
    destinationPerson: estimate.destinationPerson ?? "",
    destinationZip:   estimate.destinationZip ?? "",
    destinationAddress: estimate.destinationAddress ?? "",
    destinationTel:   estimate.destinationTel ?? "",
    destinationFax:   estimate.destinationFax ?? "",
    remarks:          estimate.remarks ?? "",
    details: estimate.details.map(d => ({
      id:              d.id,
      rowNo:           d.rowNo,
      materialCode:    d.materialCode,
      materialName:    d.materialName ?? "",
      kakouShiyouCode: d.kakouShiyouCode,
      kakouShiyou:     d.kakouShiyou ?? "",
      kakouShijiCodeT: d.kakouShijiCodeT ?? "",
      kakouShijiCodeA: d.kakouShijiCodeA ?? "",
      kakouShijiCodeB: d.kakouShijiCodeB ?? "",
      kakouT:          d.kakouT ?? "",
      kakouA:          d.kakouA ?? "",
      kakouB:          d.kakouB ?? "",
      sizeT:           Number(d.sizeT),
      sizeA:           Number(d.sizeA),
      sizeB:           Number(d.sizeB),
      kousaTUpper:     d.kousaTUpper != null ? Number(d.kousaTUpper) : null,
      kousaTLower:     d.kousaTLower != null ? Number(d.kousaTLower) : null,
      kousaAUpper:     d.kousaAUpper != null ? Number(d.kousaAUpper) : null,
      kousaALower:     d.kousaALower != null ? Number(d.kousaALower) : null,
      kousaBUpper:     d.kousaBUpper != null ? Number(d.kousaBUpper) : null,
      kousaBLower:     d.kousaBLower != null ? Number(d.kousaBLower) : null,
      mentori4:        d.mentori4 != null ? Number(d.mentori4) : null,
      mentori8:        d.mentori8 != null ? Number(d.mentori8) : null,
      quantity:        d.quantity,
      unitPrice:       d.unitPrice != null ? Number(d.unitPrice) : null,
      totalPrice:      d.totalPrice != null ? Number(d.totalPrice) : null,
      shortestDelivery: d.shortestDelivery ?? "",
      deliveryDeadline: d.deliveryDeadline?.toISOString() ?? null,
    })),
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-[#1a2744]" />
          <h1 className="font-bold text-gray-800 text-lg">
            見積編集
            {estimate.estimateNo && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                （見積No: {estimate.estimateNo}）
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/estimates"
            className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
          >
            ← 見積一覧
          </Link>
          <Link
            href="/dashboard"
            className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
          >
            メインメニュー
          </Link>
        </div>
      </div>

      <EstimateEditClient
        estimateData={estimateData}
        materials={materials}
        processingSpecs={processingSpecs}
        userInfo={userInfo}
      />
    </div>
  )
}