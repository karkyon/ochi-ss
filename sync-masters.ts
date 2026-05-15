/**
 * STEP 12-C: マスタデータ同期スクリプト（実テーブル定義版）
 *
 * 材料      : dbo.材料        (材料コード / 材料名 / Web区分フィルタ)
 * 加工仕様  : dbo.ASP加工仕様 (加工仕様コード / 加工仕様)
 *
 * 実行方法:
 *   cd ~/projects/ochi-ss
 *   npx tsx sync-masters.ts
 */

import sql from "mssql"
import { PrismaClient } from "@prisma/client"

const MSSQL_CONFIG: sql.config = {
  server: "10.1.103.164",
  port: 1433,
  database: "ochidb_dev",
  user: "jade",
  password: "RTW65b",
  options: {
    encrypt: false,
    trustServerCertificate: true,
    requestTimeout: 30_000,
    connectTimeout: 15_000,
  },
}

const prisma = new PrismaClient()

async function syncMasters() {
  console.log("=".repeat(60))
  console.log("STEP 12-C マスタ同期開始")
  console.log("=".repeat(60))

  let pool: sql.ConnectionPool | null = null

  try {
    console.log("\n[1/4] SQL Server 接続中...")
    pool = await sql.connect(MSSQL_CONFIG)
    console.log("  ✅ 接続成功")

    // ──────────────────────────────
    // 材料マスタ: dbo.材料
    // Web区分=1 のみ（Web表示対象）
    // ──────────────────────────────
    console.log("\n[2/4] dbo.材料 取得中...")
    const matResult = await pool.request().query<{ 材料コード: string; 材料名: string }>(`
      SELECT [材料コード], [材料名]
      FROM [dbo].[材料]
      WHERE ISNULL([Web区分], 0) <> '0'
        AND [材料コード] IS NOT NULL
        AND LTRIM(RTRIM([材料コード])) <> ''
      ORDER BY [材料コード]
    `)
    const materials = matResult.recordset
    console.log(`  取得件数: ${materials.length}件`)

    console.log("\n[3/4] PostgreSQL materials へ upsert...")
    let matOk = 0
    for (const row of materials) {
      const code = String(row["材料コード"]).trim()
      const name = String(row["材料名"] ?? "").trim()
      if (!code) continue
      await prisma.material.upsert({
        where:  { materialCode: code },
        update: { materialName: name, syncedAt: new Date(), updatedAt: new Date() },
        create: { materialCode: code, materialName: name, syncedAt: new Date() },
      })
      matOk++
    }
    console.log(`  ✅ 材料同期完了: ${matOk}件`)

    // ──────────────────────────────
    // 加工仕様マスタ: dbo.ASP加工仕様
    // 加工仕様コード (smallint) / 加工仕様 (varchar(10))
    // 同一コードが複数行存在するので DISTINCT
    // ──────────────────────────────
    console.log("\n[4/4] dbo.ASP加工仕様 取得中...")
    const specResult = await pool.request().query<{ 加工仕様コード: number; 加工仕様: string }>(`
      SELECT DISTINCT [加工仕様コード], [加工仕様]
      FROM [dbo].[ASP加工仕様]
      WHERE [加工仕様コード] IS NOT NULL
        AND [加工仕様] IS NOT NULL
        AND LTRIM(RTRIM([加工仕様])) <> ''
      ORDER BY [加工仕様コード]
    `)
    const specs = specResult.recordset
    console.log(`  取得件数: ${specs.length}件`)

    let specOk = 0
    for (const row of specs) {
      const code = Number(row["加工仕様コード"])
      const name = String(row["加工仕様"]).trim()
      if (!code || !name) continue
      await prisma.processingSpec.upsert({
        where:  { processingSpecCode: code },
        update: { processingSpecName: name, syncedAt: new Date(), updatedAt: new Date() },
        create: { processingSpecCode: code, processingSpecName: name, syncedAt: new Date() },
      })
      specOk++
    }
    console.log(`  ✅ 加工仕様同期完了: ${specOk}件`)

    // ── 結果確認 ──
    const matCount  = await prisma.material.count()
    const specCount = await prisma.processingSpec.count()

    console.log("\n" + "=".repeat(60))
    console.log("同期完了")
    console.log("=".repeat(60))
    console.log(`  materials        : ${matCount}件`)
    console.log(`  processing_specs : ${specCount}件`)

    const matSample  = await prisma.material.findMany({ take: 5, orderBy: { materialCode: "asc" } })
    const specSample = await prisma.processingSpec.findMany({ take: 5, orderBy: { processingSpecCode: "asc" } })

    console.log("\n  [材料サンプル]")
    matSample.forEach(m => console.log(`    ${m.materialCode} : ${m.materialName}`))
    console.log("\n  [加工仕様サンプル]")
    specSample.forEach(s => console.log(`    ${s.processingSpecCode} : ${s.processingSpecName}`))

    console.log("\n✅ STEP 12-C 完了 — /estimates/new のドロップダウンを確認してください")

  } catch (err: any) {
    console.error("\n❌ 同期エラー:", err.message)
    process.exit(1)
  } finally {
    if (pool) await pool.close()
    await prisma.$disconnect()
  }
}

syncMasters()
