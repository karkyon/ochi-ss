// GET /api/v1/cutting-methods?customerCode=xxxxx
// SQL Server の usp_ASP_CuttingMethod_get から加工指示マスタを取得
// 加工指示（W研削/G研削/レーザー等）と加工仕様（6F/6F2G等）は別物
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// 旧システム usp_ASP_CuttingMethod_get 相当の正しい加工指示デフォルト
// 加工指示表示 = "W", "G", "レーザー" など（旧ASPの加工指示コード体系）
const DEFAULT_CUTTING_METHODS = [
  { code: "W",  label: "W" },
  { code: "G",  label: "G" },
  { code: "L",  label: "レーザー" },
  { code: "P",  label: "プラズマ" },
  { code: "S",  label: "ショット" },
  { code: "H",  label: "H" },
  { code: "N",  label: "（なし）" },
]

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const customerCode = searchParams.get("customerCode") ?? ""

  // SQL Server から取得試行（usp_ASP_CuttingMethod_get）
  try {
    const { getSqlServerPool } = await import("@/lib/sqlserver").catch(() => ({ getSqlServerPool: null }))
    if (getSqlServerPool) {
      const pool = await (getSqlServerPool as Function)()
      const result = await pool.request()
        .input("CostomerCd", customerCode)
        .execute("usp_ASP_CuttingMethod_get")
      if (result.recordset && result.recordset.length > 0) {
        const methods = result.recordset.map((r: any) => ({
          code: String(r["加工指示コード"] ?? r.code ?? ""),
          label: String(r["加工指示表示"] ?? r["加工指示名称"] ?? r.label ?? ""),
        })).filter((m: any) => m.code && m.label)
        return NextResponse.json({ methods, source: "sqlserver" })
      }
    }
  } catch (err: any) {
    console.warn("[cutting-methods] SQL Server接続失敗、デフォルト使用:", err.message)
  }

  // fallback: 正しい加工指示デフォルト（加工仕様ではない）
  return NextResponse.json({ methods: DEFAULT_CUTTING_METHODS, source: "default" })
}
