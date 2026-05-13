// =============================================================
//  sync-service/src/db/sqlserver.ts  （修正版 v2）
//
//  mssql の config 型に connectionString キーは存在しない
//  接続文字列を使う場合は parseConnectionString() を使うか、
//  環境変数を個別キーに分解して渡す
//
//  環境変数形式:
//    SQLSERVER_CONNECTION_STRING=
//      "Server=<host>,<port>;Database=<db>;User Id=<user>;Password=<pass>;
//       Encrypt=true;TrustServerCertificate=false;"
// =============================================================

import * as sql from "mssql"

// ------------------------------------------------------------------
// 接続文字列パーサー
// "Server=host,1433;Database=db;User Id=sa;Password=pass;..." を
// mssql の config オブジェクトに変換
// ------------------------------------------------------------------
function parseConnectionString(connStr: string): sql.config {
  const params: Record<string, string> = {}
  connStr.split(";").forEach((part) => {
    const idx = part.indexOf("=")
    if (idx === -1) return
    const key = part.slice(0, idx).trim().toLowerCase()
    const val = part.slice(idx + 1).trim()
    params[key] = val
  })

  // "server,port" or "server" の形式に対応
  const serverPart = params["server"] ?? "localhost"
  const [serverHost, portStr] = serverPart.split(",")
  const port = portStr ? parseInt(portStr, 10) : 1433

  return {
    server: serverHost ?? "localhost",
    port,
    database: params["database"] ?? params["initial catalog"] ?? "master",
    user: params["user id"] ?? params["uid"] ?? "sa",
    password: params["password"] ?? params["pwd"] ?? "",
    options: {
      encrypt: (params["encrypt"] ?? "true").toLowerCase() === "true",
      trustServerCertificate:
        (params["trustservercertificate"] ?? "false").toLowerCase() === "true",
      connectTimeout: 30000,
      requestTimeout: 120000,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  }
}

// ------------------------------------------------------------------
// コネクションプール（シングルトン）
// ------------------------------------------------------------------
let pool: sql.ConnectionPool | null = null

export async function getSqlServerPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) return pool

  const connStr = process.env.SQLSERVER_CONNECTION_STRING
  if (!connStr) {
    throw new Error(
      "SQLSERVER_CONNECTION_STRING が未設定です。docker/.env を確認してください。"
    )
  }

  const config = parseConnectionString(connStr)
  pool = new sql.ConnectionPool(config)

  pool.on("error", (err: Error) => {
    console.error("[SQL Server] Pool エラー:", err)
    pool = null
  })

  await pool.connect()
  console.log("[SQL Server] 接続プール確立")
  return pool
}

export async function closeSqlServerPool(): Promise<void> {
  if (pool) {
    await pool.close()
    pool = null
    console.log("[SQL Server] 接続プールを閉じました")
  }
}

export { sql }
