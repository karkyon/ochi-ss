// src/app/api/v1/tolerance/standard/route.ts
// ============================================================
// 標準公差取得 API
//   GET /api/v1/tolerance/standard?customerCode={code}
//   → usp_ASP_ToleranceSetting_get を呼び出す
//
// SPの実定義:
//   CREATE PROCEDURE usp_ASP_ToleranceSetting_get (@TokuisakiCd varchar(6) = '')
//   → OUTPUTパラメータなし。SELECTで結果セットを返す
//   カラム: 標準公差1T, 標準公差2T, 標準公差1A, 標準公差2A, 標準公差1B, 標準公差2B
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
    // SP は INPUT パラメータ1つのみ・OUTPUTなし・SELECTで結果セットを返す
    request.input("TokuisakiCd", sql.VarChar(6), customerCode)

    const result = await request.execute("usp_ASP_ToleranceSetting_get")

    if (!result.recordset || result.recordset.length === 0) {
      // 得意先別設定なし → デフォルト値（0）を返す
      return NextResponse.json({
        success: true,
        tolerance: {
          tUpper: 0, tLower: 0,
          aUpper: 0, aLower: 0,
          bUpper: 0, bLower: 0,
        },
      })
    }

    const row = result.recordset[0]
    return NextResponse.json({
      success: true,
      tolerance: {
        tUpper: Number(row["標準公差1T"] ?? 0),
        tLower: Number(row["標準公差2T"] ?? 0),
        aUpper: Number(row["標準公差1A"] ?? 0),
        aLower: Number(row["標準公差2A"] ?? 0),
        bUpper: Number(row["標準公差1B"] ?? 0),
        bLower: Number(row["標準公差2B"] ?? 0),
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