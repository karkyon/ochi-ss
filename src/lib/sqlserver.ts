// src/lib/sqlserver.ts
// ============================================================
// SQL Server 接続プール — Next.js API Routes 用
//
// sync-service/src/db/sqlserver.ts と同じロジックを
// Next.js src/lib/ に配置したもの。
// VPN経由で OCHISRV (10.1.103.164:1433) に接続する。
//
// 環境変数:
//   SQLSERVER_CONNECTION_STRING=
//     "Server=10.1.103.164,1433;Database=ochidb_dev;
//      User Id=jade;Password=RTW65b;
//      Encrypt=false;TrustServerCertificate=true;"
//
// ※ サーバーレスNext.jsではなくself-hosted前提のため
//    プロセスシングルトンで管理
// ============================================================

import * as mssql from "mssql"

export { mssql as sql }

// ────────────────────────────────────────────────
// 接続文字列パーサー
// ────────────────────────────────────────────────
function parseConnectionString(connStr: string): mssql.config {
  const params: Record<string, string> = {}
  connStr.split(";").forEach((part) => {
    const idx = part.indexOf("=")
    if (idx === -1) return
    const key = part.slice(0, idx).trim().toLowerCase()
    const val = part.slice(idx + 1).trim()
    params[key] = val
  })

  const serverPart = params["server"] ?? "localhost"
  const [serverHost, portStr] = serverPart.split(",")
  const port = portStr ? parseInt(portStr, 10) : 1433

  return {
    server:   serverHost ?? "localhost",
    port,
    database: params["database"] ?? params["initial catalog"] ?? "master",
    user:     params["user id"]  ?? params["uid"]             ?? "sa",
    password: params["password"] ?? params["pwd"]             ?? "",
    options: {
      encrypt:                (params["encrypt"]                  ?? "true").toLowerCase()  === "true",
      trustServerCertificate: (params["trustservercertificate"]   ?? "false").toLowerCase() === "true",
      connectTimeout:  30_000,
      requestTimeout: 120_000,
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30_000,
    },
  }
}

// ────────────────────────────────────────────────
// シングルトン接続プール
// ────────────────────────────────────────────────
declare global {
  // Next.js の HMR でも再利用できるように global に保持
  // eslint-disable-next-line no-var
  var __sqlPool: mssql.ConnectionPool | undefined
}

export async function getSqlServerPool(): Promise<mssql.ConnectionPool> {
  if (global.__sqlPool && global.__sqlPool.connected) {
    return global.__sqlPool
  }

  const connStr = process.env.SQLSERVER_CONNECTION_STRING
  if (!connStr) {
    throw new Error(
      "SQLSERVER_CONNECTION_STRING が未設定です。docker/.env または .env.local を確認してください。"
    )
  }

  const config = parseConnectionString(connStr)
  const pool = new mssql.ConnectionPool(config)

  pool.on("error", (err: Error) => {
    console.error("[SQL Server] Pool エラー:", err)
    global.__sqlPool = undefined
  })

  await pool.connect()
  console.log("[SQL Server] 接続プール確立")
  global.__sqlPool = pool
  return pool
}

export async function closeSqlServerPool(): Promise<void> {
  if (global.__sqlPool) {
    await global.__sqlPool.close()
    global.__sqlPool = undefined
    console.log("[SQL Server] 接続プールを閉じました")
  }
}