"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sql = void 0;
exports.getSqlServerPool = getSqlServerPool;
exports.closeSqlServerPool = closeSqlServerPool;
const sql = __importStar(require("mssql"));
exports.sql = sql;
// ------------------------------------------------------------------
// 接続文字列パーサー
// "Server=host,1433;Database=db;User Id=sa;Password=pass;..." を
// mssql の config オブジェクトに変換
// ------------------------------------------------------------------
function parseConnectionString(connStr) {
    const params = {};
    connStr.split(";").forEach((part) => {
        const idx = part.indexOf("=");
        if (idx === -1)
            return;
        const key = part.slice(0, idx).trim().toLowerCase();
        const val = part.slice(idx + 1).trim();
        params[key] = val;
    });
    // "server,port" or "server" の形式に対応
    const serverPart = params["server"] ?? "localhost";
    const [serverHost, portStr] = serverPart.split(",");
    const port = portStr ? parseInt(portStr, 10) : 1433;
    return {
        server: serverHost ?? "localhost",
        port,
        database: params["database"] ?? params["initial catalog"] ?? "master",
        user: params["user id"] ?? params["uid"] ?? "sa",
        password: params["password"] ?? params["pwd"] ?? "",
        options: {
            encrypt: (params["encrypt"] ?? "true").toLowerCase() === "true",
            trustServerCertificate: (params["trustservercertificate"] ?? "false").toLowerCase() === "true",
            connectTimeout: 30000,
            requestTimeout: 120000,
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000,
        },
    };
}
// ------------------------------------------------------------------
// コネクションプール（シングルトン）
// ------------------------------------------------------------------
let pool = null;
async function getSqlServerPool() {
    if (pool && pool.connected)
        return pool;
    const connStr = process.env.SQLSERVER_CONNECTION_STRING;
    if (!connStr) {
        throw new Error("SQLSERVER_CONNECTION_STRING が未設定です。docker/.env を確認してください。");
    }
    const config = parseConnectionString(connStr);
    pool = new sql.ConnectionPool(config);
    pool.on("error", (err) => {
        console.error("[SQL Server] Pool エラー:", err);
        pool = null;
    });
    await pool.connect();
    console.log("[SQL Server] 接続プール確立");
    return pool;
}
async function closeSqlServerPool() {
    if (pool) {
        await pool.close();
        pool = null;
        console.log("[SQL Server] 接続プールを閉じました");
    }
}
