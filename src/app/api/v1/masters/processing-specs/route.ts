// src/app/api/v1/masters/processing-specs/route.ts
// GET /api/v1/masters/processing-specs
// 加工仕様マスタ取得（PostgreSQLキャッシュ優先、SQLServer同期付き）
// レスポンス: { specs: [{processingSpecCode, processingSpecName, kakouShijiT, kakouShijiA, kakouShijiB}] }
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// WO加工仕様テーブルの静的フォールバック
// SQL Server未接続時に使用（添付SSのWO加工仕様テーブルデータ準拠）
const FALLBACK_SPECS = [
  { code: 2,  name: "6F",    t: "W",  a: "W",  b: "W"  },
  { code: 4,  name: "2F2G",  t: "RG", a: "〜", b: "〜" },
  { code: 5,  name: "4F2G",  t: "RG", a: "〜", b: "W"  },
  { code: 7,  name: "6F2G",  t: "RG", a: "W",  b: "W"  },
  { code: 8,  name: "6F2G",  t: "W",  a: "RG", b: "W"  },
  { code: 9,  name: "6F2G",  t: "W",  a: "W",  b: "RG" },
  { code: 10, name: "4F",    t: "W",  a: "〜", b: "W"  },
  { code: 11, name: "2F",    t: "W",  a: "〜", b: "〜" },
  { code: 12, name: "2F2G",  t: "〜", a: "RG", b: "〜" },
  { code: 13, name: "2F2G",  t: "〜", a: "〜", b: "RG" },
  { code: 14, name: "4F2G",  t: "〜", a: "W",  b: "RG" },
  { code: 15, name: "2F",    t: "〜", a: "〜", b: "W"  },
  { code: 16, name: "黒皮",  t: "〜", a: "〜", b: "〜" },
  { code: 17, name: "6F2SG", t: "SG", a: "W",  b: "W"  },
  { code: 20, name: "4F",    t: "〜", a: "W",  b: "〜" },
  { code: 22, name: "6F2SG", t: "W",  a: "SG", b: "W"  },
  { code: 23, name: "6F2SG", t: "W",  a: "W",  b: "SG" },
  { code: 33, name: "4F2G",  t: "W",  a: "〜", b: "RG" },
  { code: 43, name: "4F2G",  t: "〜", a: "W",  b: "W"  },
  { code: 44, name: "2F",    t: "〜", a: "W",  b: "〜" },
  { code: 45, name: "4F2G",  t: "RG", a: "W",  b: "〜" },
  { code: 117,name: "4F2G",  t: "W",  a: "RG", b: "〜" },
]

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // SQLServerからWO加工仕様テーブルを取得して同期
  let syncedFromSqlServer = false
  try {
    const { getSqlServerPool, sql } = await import("@/lib/sqlserver")
    const pool = await getSqlServerPool()
    const result = await pool.request().query(`
      SELECT
        [加工仕様コード],
        [加工指示コードT],
        [加工指示コードA],
        [加工指示コードB],
        [加工仕様]
      FROM [dbo].[WO加工仕様]
      WHERE [加工指示コードT] IN (1,2,4,5)
         OR [加工指示コードA] IN (1,2,4,5)
         OR [加工指示コードB] IN (1,2,4,5)
      ORDER BY [加工仕様コード]
    `)

    // 加工指示コード → 文字列変換
    const codeToStr = (c: number): string => {
      if (c === 1) return "RG"
      if (c === 2) return "W"
      if (c === 4) return "〜"
      if (c === 5) return "SG"
      return "W"
    }

    for (const row of result.recordset) {
      const specCode = Number(row["加工仕様コード"])
      const specName = String(row["加工仕様"] ?? "").trim()
      const t = codeToStr(Number(row["加工指示コードT"]))
      const a = codeToStr(Number(row["加工指示コードA"]))
      const b = codeToStr(Number(row["加工指示コードB"]))
      if (!specCode || !specName) continue
      await prisma.processingSpec.upsert({
        where: { processingSpecCode: specCode },
        update: { processingSpecName: specName, kakouShijiT: t, kakouShijiA: a, kakouShijiB: b, syncedAt: new Date() },
        create: { processingSpecCode: specCode, processingSpecName: specName, kakouShijiT: t, kakouShijiA: a, kakouShijiB: b },
      })
    }
    syncedFromSqlServer = true
    console.log(`[processing-specs] SQLServer同期完了: ${result.recordset.length}件`)
  } catch (err: any) {
    console.warn("[processing-specs] SQLServer接続失敗、DBキャッシュ使用:", err.message)
    // フォールバック: 静的データでPostgreSQLを初期化
    for (const s of FALLBACK_SPECS) {
      try {
        await prisma.processingSpec.upsert({
          where: { processingSpecCode: s.code },
          update: { processingSpecName: s.name, kakouShijiT: s.t, kakouShijiA: s.a, kakouShijiB: s.b },
          create: { processingSpecCode: s.code, processingSpecName: s.name, kakouShijiT: s.t, kakouShijiA: s.a, kakouShijiB: s.b },
        })
      } catch { /* ignore */ }
    }
  }

  // PostgreSQLから取得して返す
  const specs = await prisma.processingSpec.findMany({
    orderBy: { processingSpecCode: "asc" },
    select: {
      processingSpecCode: true,
      processingSpecName: true,
      kakouShijiT: true,
      kakouShijiA: true,
      kakouShijiB: true,
    },
  })

  return NextResponse.json({ specs, syncedFromSqlServer })
}
