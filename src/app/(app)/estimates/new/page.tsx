import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import EstimateNewClient from "./EstimateNewClient"

export default async function EstimateNewPage() {
  const session = await auth()

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

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* ページタイトル */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-[#1a2744]" />
          <h1 className="font-bold text-gray-800 text-lg">お見積り入力</h1>
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
      />
    </div>
  )
}
