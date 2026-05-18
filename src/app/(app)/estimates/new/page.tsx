import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import EstimateNewClient from "./EstimateNewClient"

interface Props {
  searchParams: Promise<{ copyFrom?: string }>
}

export default async function EstimateNewPage({ searchParams }: Props) {
  const session = await auth()
  const { copyFrom } = await searchParams

  // マスタデータをサーバーサイドで取得（ドロップダウン用）
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

  // セッション情報をクライアントに渡す
  const userInfo = {
    customerCode: session!.user.companyCode ?? "",
    customerName:  session!.user.customerName ?? "",
    chargeName:    session!.user.chargeName ?? "",
    userId:        session!.user.userId ?? "",
  }

  // copyFrom: コピー元見積データを取得
  let copySourceData: {
    customerOrderNo: string
    endUserNo: string
    destinationCode: string
    destinationName: string
    destinationDept: string
    destinationPerson: string
    destinationZip: string
    destinationAddress: string
    destinationTel: string
    destinationFax: string
    remarks: string
    details: {
      materialCode: string
      materialName: string
      kakouShiyouCode: number
      kakouShiyou: string
      kakouShijiCodeT: string
      kakouShijiCodeA: string
      kakouShijiCodeB: string
      kakouT: string
      kakouA: string
      kakouB: string
      sizeT: number
      sizeA: number
      sizeB: number
      kousaTUpper: number | null
      kousaTLower: number | null
      kousaAUpper: number | null
      kousaALower: number | null
      kousaBUpper: number | null
      kousaBLower: number | null
      mentori4: number | null
      mentori8: number | null
      quantity: number
      unitPrice: number | null
      totalPrice: number | null
      shortestDelivery: string
      deliveryDeadline: string | null
    }[]
  } | null = null

  if (copyFrom) {
    console.log('[/estimates/new] copyFrom:', copyFrom)
    const src = await prisma.estimateHeader.findFirst({
      where: {
        id: copyFrom,
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
    if (src) {
      copySourceData = {
        customerOrderNo:  src.customerOrderNo ?? "",
        endUserNo:        src.endUserNo ?? "",
        destinationCode:  src.destinationCode ?? "",
        destinationName:  src.destinationName ?? "",
        destinationDept:  src.destinationDept ?? "",
        destinationPerson: src.destinationPerson ?? "",
        destinationZip:   src.destinationZip ?? "",
        destinationAddress: src.destinationAddress ?? "",
        destinationTel:   src.destinationTel ?? "",
        destinationFax:   src.destinationFax ?? "",
        remarks:          src.remarks ?? "",
        details: src.details.map(d => ({
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
          deliveryDeadline: d.deliveryDeadline ? d.deliveryDeadline.toISOString().slice(0, 10) : null,
        })),
      }
      console.log('[/estimates/new] コピー元取得完了, 明細件数:', copySourceData.details.length)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* ページタイトル */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-[#1a2744]" />
          <h1 className="font-bold text-gray-800 text-lg">
            {copyFrom ? "お見積り複写" : "お見積り入力"}
          </h1>
        </div>
        <Link
          href="/dashboard"
          className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
        >
          ← メインメニュー
        </Link>
      </div>

      {/* Client Component にマスタデータを渡す */}
      <EstimateNewClient
        materials={materials}
        processingSpecs={processingSpecs}
        userInfo={userInfo}
        copySource={copySourceData}
      />
    </div>
  )
}
