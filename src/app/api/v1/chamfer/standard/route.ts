// src/app/api/v1/chamfer/standard/route.ts
// ============================================================
// 標準面取り取得 API
//   GET /api/v1/chamfer/standard?customerCode={code}
//   → usp_ASP_ChamferAmountSetting_get を呼び出す
//
// SPの実定義:
//   CREATE PROCEDURE usp_ASP_ChamferAmountSetting_get (@TokuisakiCd varchar(6) = '')
//   → OUTPUTパラメータなし。SELECTで結果セットを返す
//   カラム: 面取指示区分, 標準面取4C, 標準面取8C
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

  console.log('[GET /chamfer/standard] customerCode:', customerCode)
  let pool: Awaited<ReturnType<typeof getSqlServerPool>>
  try {
    pool = await getSqlServerPool()
  } catch {
    return NextResponse.json({ error: "データベース接続に失敗しました" }, { status: 503 })
  }

  try {
    const request = pool.request()
    // SP は INPUT パラメータ1つのみ・OUTPUTなし・SELECTで結果セットを返す
    request.input("TokuisakiCd", sql.VarChar(6), customerCode)

    const result = await request.execute("usp_ASP_ChamferAmountSetting_get")

    if (!result.recordset || result.recordset.length === 0) {
      // 得意先別設定なし → デフォルト値（0）を返す
      return NextResponse.json({
        success: true,
        chamfer: { chamfer4: 0, chamfer8: 0 },
      })
    }

    const row = result.recordset[0]
    return NextResponse.json({
      success: true,
      chamfer: {
        chamfer4: Number(row["標準面取4C"] ?? 0),
        chamfer8: Number(row["標準面取8C"] ?? 0),
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