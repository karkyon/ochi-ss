// GET /api/v1/direct-deliveries/search?q=xxx&customerCode=xxxxx
// 直送先マスタ検索。SQL Server 接続失敗時は PostgreSQL fallback
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const q            = searchParams.get("q")            ?? ""
  const customerCode = searchParams.get("customerCode") ?? session.user.companyCode ?? ""

  // SQL Server 試行
  try {
    const { getSqlServerPool } = await import("@/lib/sqlserver").catch(() => ({ getSqlServerPool: null }))
    if (getSqlServerPool) {
      const pool = await (getSqlServerPool as Function)()
      const result = await pool.request()
        .input("CustomerCode", customerCode)
        .input("Query", `%${q}%`)
        .query(`
          SELECT TOP 50
            直送先コード AS deliveryCode,
            直送先名称   AS companyName,
            部署名       AS departmentName,
            担当者名     AS contactPerson,
            郵便番号     AS postalCode,
            住所1        AS address1,
            住所2        AS address2,
            電話番号     AS phoneNumber,
            FAX番号      AS faxNumber
          FROM 直送先マスタ
          WHERE 得意先コード = @CustomerCode
            AND 有効フラグ = 1
            AND (直送先名称 LIKE @Query OR 直送先コード LIKE @Query OR 住所1 LIKE @Query)
          ORDER BY 直送先コード
        `)
      return NextResponse.json({ deliveries: result.recordset, total: result.recordset.length, source: "sqlserver" })
    }
  } catch (err: any) {
    console.error("[direct-deliveries/search] SQL Serverエラー:", err.message)
  }

  // PostgreSQL fallback
  try {
    const rows = await prisma.directDelivery.findMany({
      where: {
        customerId: session.user.customerId!,
        isDeleted: false,
        ...(q ? {
          OR: [
            { companyName:   { contains: q } },
            { deliveryCode:  { contains: q } },
            { address1:      { contains: q } },
          ],
        } : {}),
      },
      orderBy: { deliveryCode: "asc" },
      take: 50,
    })
    return NextResponse.json({
      deliveries: rows.map(r => ({
        deliveryCode:   r.deliveryCode,
        companyName:    r.companyName,
        departmentName: r.departmentName ?? "",
        contactPerson:  r.contactPerson ?? "",
        postalCode:     r.postalCode ?? "",
        address1:       r.address1 ?? "",
        address2:       "",
        phoneNumber:    r.phoneNumber ?? "",
        faxNumber:      r.faxNumber ?? "",
      })),
      total: rows.length,
      source: "postgres_fallback",
    })
  } catch (err: any) {
    console.error("[direct-deliveries/search] PostgreSQLエラー:", err.message)
    return NextResponse.json({ error: "検索失敗" }, { status: 500 })
  }
}
