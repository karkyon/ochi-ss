// /masters/direct-delivery — 直送先管理ページ (Server Component)
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import DirectDeliveryClient from "./DirectDeliveryClient"

export default async function DirectDeliveryPage() {
  const session = await auth()

  const rows = await prisma.directDelivery.findMany({
    where: { customerId: session!.user.customerId!, isDeleted: false },
    orderBy: { deliveryCode: "asc" },
  })

  const deliveries = rows.map(r => ({
    id:               r.id,
    deliveryCode:     r.deliveryCode,
    companyName:      r.companyName,
    furigana:         r.furigana ?? "",
    shortName:        r.shortName ?? "",
    corporateType:    r.corporateType ?? "",
    corporatePosition: r.corporatePosition ?? "",
    departmentName:   r.departmentName ?? "",
    contactPerson:    r.contactPerson ?? "",
    postalCode:       r.postalCode ?? "",
    address1:         r.address1 ?? "",
    address2:         r.address2 ?? "",
    address3:         r.address3 ?? "",
    phoneNumber:      r.phoneNumber ?? "",
    faxNumber:        r.faxNumber ?? "",
    remarks:          r.remarks ?? "",
  }))

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full bg-[#1a2744]" />
          <h1 className="font-bold text-gray-800 text-lg">納入先管理</h1>
        </div>
        <Link href="/dashboard" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors">
          メインメニュー
        </Link>
      </div>
      <DirectDeliveryClient deliveries={deliveries} customerCode={session!.user.companyCode ?? ""} customerId={session!.user.customerId ?? ""} />
    </div>
  )
}
