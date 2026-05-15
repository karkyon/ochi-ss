// src/app/api/v1/direct-deliveries/search/route.ts
// STEP 12-D: 直送先検索API
// GET /api/v1/direct-deliveries/search?q={keyword}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getSqlServerPool } from "@/lib/sqlserver"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim() ?? ""

  if (q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const customerCode = (session.user as any).companyCode ?? ""

  try {
    const pool = await getSqlServerPool()
    const req = pool.request()

    req.input("TokuisakiCd", customerCode)
    req.input("Keyword", `%${q}%`)

    const result = await req.query(`
      SELECT TOP 50
        [直送先コード]  AS deliveryCode,
        [名称]          AS name,
        [フリガナ]      AS nameKana,
        [略称]          AS shortName,
        [郵便番号]      AS postalCode,
        [住所1]         AS address1,
        [住所2]         AS address2,
        [住所3]         AS address3,
        [TEL]           AS tel,
        [FAX]           AS fax,
        [担当者名]      AS chargeName,
        [部署名]        AS departmentName
      FROM [ASP直送先]
      WHERE [得意先コード] = @TokuisakiCd
        AND (
          [名称]        LIKE @Keyword
          OR [フリガナ] LIKE @Keyword
          OR [略称]     LIKE @Keyword
          OR [住所1]    LIKE @Keyword
          OR [住所2]    LIKE @Keyword
          OR [住所3]    LIKE @Keyword
          OR [TEL]      LIKE @Keyword
          OR [直送先コード] LIKE @Keyword
        )
      ORDER BY [直送先コード]
    `)

    const results = result.recordset.map((row: any) => ({
      deliveryCode:   String(row.deliveryCode ?? "").trim(),
      name:           String(row.name ?? "").trim(),
      nameKana:       String(row.nameKana ?? "").trim(),
      shortName:      String(row.shortName ?? "").trim(),
      postalCode:     String(row.postalCode ?? "").trim(),
      address1:       String(row.address1 ?? "").trim(),
      address2:       String(row.address2 ?? "").trim(),
      address3:       String(row.address3 ?? "").trim(),
      tel:            String(row.tel ?? "").trim(),
      fax:            String(row.fax ?? "").trim(),
      chargeName:     String(row.chargeName ?? "").trim(),
      departmentName: String(row.departmentName ?? "").trim(),
    }))

    return NextResponse.json({ results })

  } catch (err: any) {
    console.error("[direct-deliveries/search] エラー:", err.message)
    return NextResponse.json(
      { error: "直送先検索に失敗しました", detail: err.message },
      { status: 500 }
    )
  }
}