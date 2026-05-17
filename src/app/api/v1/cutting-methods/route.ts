// src/app/api/v1/cutting-methods/route.ts
// GET /api/v1/cutting-methods?customerCode={code}
// 旧: usp_ASP_CuttingMethod_get(@CostomerCd)
// DataValueField="加工指示コード"(tinyint), DataTextField="加工指示表示"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getSqlServerPool } from "@/lib/sqlserver"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const customerCode =
    request.nextUrl.searchParams.get("customerCode") ??
    (session.user as any).companyCode ?? ""

  console.log('[GET /cutting-methods] customerCode:', customerCode)
  try {
    const pool = await getSqlServerPool()
    const req = pool.request()
    req.input("CostomerCd", customerCode)

    const result = await req.execute("usp_ASP_CuttingMethod_get")

    const methods = result.recordset.map((row: any) => ({
      code:  row["加工指示コード"] != null ? Number(row["加工指示コード"]) : null,
      label: String(row["加工指示表示"] ?? "").trim(),
    })).filter((m: any) => m.code != null)

    return NextResponse.json({ methods })

  } catch (err: any) {
    console.error("[cutting-methods] エラー:", err.message)
    return NextResponse.json(
      { error: "加工指示取得に失敗しました", detail: err.message },
      { status: 500 }
    )
  }
}