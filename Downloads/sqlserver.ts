/**
 * db/sqlserver.ts
 * SQL Server 接続プール（シングルトン）
 * Azure VPN Gateway 経由での接続を想定
 */

import sql from "mssql";

let pool: sql.ConnectionPool | null = null;

const config: sql.config = {
  connectionString: process.env.SQLSERVER_CONNECTION_STRING!,
  options: {
    encrypt: true,                    // Azure SQL は必須
    trustServerCertificate: false,    // 本番: false
    connectTimeout: 30000,
    requestTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000,
  },
};

export async function getSqlServerPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) return pool;

  pool = new sql.ConnectionPool(config);

  pool.on("error", (err) => {
    console.error("[SqlServer] pool error:", err);
    pool = null; // 次回呼び出し時に再接続
  });

  await pool.connect();
  console.log("[SqlServer] connected");
  return pool;
}

export async function closeSqlServerPool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}
