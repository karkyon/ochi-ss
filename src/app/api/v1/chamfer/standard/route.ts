// src/app/api/v1/chamfer/standard/route.ts
// ============================================================
// 標準面取り取得 API
//   GET /api/v1/chamfer/standard?customerCode={code}
//   → usp_ASP_ChamferAmountSetting_get を呼び出して
//     顧客別の標準面取り値 (Chamfer4 / Chamfer8) を返す
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
    request.output("Mentori_4", sql.Decimal(5, 2))
    request.output("Mentori_8", sql.Decimal(5, 2))

    const result = await request.execute("usp_ASP_ChamferAmountSetting_get")
    const out = result.output

    return NextResponse.json({
      success: true,
      chamfer: {
        chamfer4: Number(out["Mentori_4"] ?? 0),
        chamfer8: Number(out["Mentori_8"] ?? 0),
      },
    })
  } catch (err: any) {
    console.error("[chamfer/standard] SP エラー:", err)
    return NextResponse.json(
      { error: "標準面取り取得に失敗しました", detail: err.message },
      { status: 500 }
    )
  }
}