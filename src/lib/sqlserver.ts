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

import * as mssqlModule from "mssql"

// ────────────────────────────────────────────────
// HMR対策: mssqlモジュール参照のプロセス内固定化
// Next.js dev環境のHMRでAPI Route群が再バンドルされると、
// `import * as mssql from "mssql"` が複数チャンクで個別に require され、
// mssql内部 tedious/request.js の TYPES厳密等価比較(===)が破綻し
// "parameter.type.validate is not a function" が発生する。
// global に保持した単一インスタンスを常に再利用することで回避する。
// ────────────────────────────────────────────────
declare global {
  // eslint-disable-next-line no-var
  var __mssqlModule: typeof mssqlModule | undefined
}

if (!global.__mssqlModule) {
  global.__mssqlModule = mssqlModule
}

const mssql = global.__mssqlModule

export { mssql as sql }

// ────────────────────────────────────────────────
// 接続文字列パーサー
// ────────────────────────────────────────────────
function parseConnectionString(connStr: string): mssqlModule.config {
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
  var __sqlPool: mssqlModule.ConnectionPool | undefined
}

export async function getSqlServerPool(): Promise<mssqlModule.ConnectionPool> {
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
