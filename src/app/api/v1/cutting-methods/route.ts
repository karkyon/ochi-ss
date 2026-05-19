// GET /api/v1/cutting-methods?customerCode=xxxxx
// SQL Server から加工指示マスタを取得。接続失敗時は PostgreSQL fallback
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// PostgreSQL fallback 用デフォルト加工指示
const DEFAULT_CUTTING_METHODS = [
  { code: 0,  label: "（なし）" },
  { code: 1,  label: "平行" },
  { code: 2,  label: "垂直" },
  { code: 3,  label: "斜め45°" },
  { code: 4,  label: "斜め30°" },
  { code: 5,  label: "斜め60°" },
  { code: 6,  label: "R加工" },
  { code: 7,  label: "テーパー" },
  { code: 8,  label: "段付き" },
  { code: 9,  label: "その他" },
]

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const customerCode = searchParams.get("customerCode") ?? ""

  // SQL Server から取得試行
  try {
    const { getSqlServerPool } = await import("@/lib/sqlserver").catch(() => ({ getSqlServerPool: null }))
    if (getSqlServerPool) {
      const pool = await (getSqlServerPool as Function)()
      const result = await pool.request()
        .input("CustomerCode", customerCode)
        .query(`
          SELECT 加工指示コード AS code, 加工指示名称 AS label
          FROM 加工指示マスタ
          WHERE 有効フラグ = 1
          ORDER BY 加工指示コード
        `)
      return NextResponse.json({ methods: result.recordset, source: "sqlserver" })
    }
  } catch (err: any) {
    console.error("[cutting-methods] SQL Serverエラー:", err.message)
  }

  // PostgreSQL ProcessingSpec fallback
  try {
    const specs = await prisma.processingSpec.findMany({
      where: {},
      orderBy: { processingSpecCode: "asc" },
      select: { processingSpecCode: true, processingSpecName: true },
    })
    if (specs.length > 0) {
      return NextResponse.json({
        methods: specs.map(s => ({ code: s.processingSpecCode, label: s.processingSpecName })),
        source: "postgres_fallback",
      })
    }
  } catch { /* silent */ }

  // 最終 fallback: ハードコードデフォルト
  return NextResponse.json({ methods: DEFAULT_CUTTING_METHODS, source: "default_fallback" })
}
