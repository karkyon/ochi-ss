// src/app/api/v1/tolerance/standard/route.ts
// ============================================================
// 標準公差取得 API
//   GET /api/v1/tolerance/standard?customerCode={code}
//   → usp_ASP_ToleranceSetting_get を呼び出して
//     顧客別の標準公差 6値を返す
// ============================================================

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getSqlServerPool, sql } from "@/lib/sqlserver"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const customerCode =
    req.nextUrl.searchParams.get("customerCode") ??
    session.user.companyCode ??
    ""

  let pool: Awaited<ReturnType<typeof getSqlServerPool>>
  try {
    pool = await getSqlServerPool()
  } catch {
    return NextResponse.json({ error: "データベース接続に失敗しました" }, { status: 503 })
  }

  try {
    const request = pool.request()
    request.input("TokuisakiCd", sql.NVarChar(6), customerCode)
    request.output("Kousa_T_U", sql.Decimal(6, 3))
    request.output("Kousa_T_L", sql.Decimal(6, 3))
    request.output("Kousa_A_U", sql.Decimal(6, 3))
    request.output("Kousa_A_L", sql.Decimal(6, 3))
    request.output("Kousa_B_U", sql.Decimal(6, 3))
    request.output("Kousa_B_L", sql.Decimal(6, 3))

    const result = await request.execute("usp_ASP_ToleranceSetting_get")
    const out = result.output

    return NextResponse.json({
      success: true,
      tolerance: {
        tUpper: Number(out["Kousa_T_U"] ?? 0),
        tLower: Number(out["Kousa_T_L"] ?? 0),
        aUpper: Number(out["Kousa_A_U"] ?? 0),
        aLower: Number(out["Kousa_A_L"] ?? 0),
        bUpper: Number(out["Kousa_B_U"] ?? 0),
        bLower: Number(out["Kousa_B_L"] ?? 0),
      },
    })
  } catch (err: any) {
    console.error("[tolerance/standard] SP エラー:", err)
    return NextResponse.json(
      { error: "標準公差取得に失敗しました", detail: err.message },
      { status: 500 }
    )
  }
}