// =============================================================
//  src/lib/prisma.ts  v3 — Prisma 6 $extends 暗号化実装
// =============================================================
import { PrismaClient } from "@prisma/client"
import { encrypt, decrypt } from "./crypto"

// 暗号化対象フィールド定義
const ENCRYPTED: Record<string, string[]> = {
  estimateHeader: ["destinationAddress", "destinationTel", "destinationFax"],
  directDelivery: ["address1", "address2", "address3", "phoneNumber", "faxNumber"],
}

function encryptFields(model: string, data: any) {
  const fields = ENCRYPTED[model]
  if (!fields || !data) return data
  const result = { ...data }
  for (const f of fields) {
    if (result[f] != null && typeof result[f] === "string" && !result[f].includes(":")) {
      try { result[f] = encrypt(result[f]) } catch { /* skip */ }
    }
  }
  return result
}

function decryptRecord(model: string, record: any): any {
  if (!record || typeof record !== "object") return record
  const fields = ENCRYPTED[model]
  if (!fields) return record
  const result = { ...record }
  for (const f of fields) {
    if (result[f] != null && typeof result[f] === "string" && result[f].includes(":")) {
      try { result[f] = decrypt(result[f]) } catch { /* 移行期の平文は無視 */ }
    }
  }
  return result
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })

// $extends で透過的な暗号化・復号
export const prisma = basePrisma.$extends({
  query: {
    estimateHeader: {
      async create({ args, query }) {
        if (args.data) args.data = encryptFields("estimateHeader", args.data) as any
        return query(args)
      },
      async update({ args, query }) {
        if (args.data) args.data = encryptFields("estimateHeader", args.data) as any
        return query(args)
      },
      async findFirst({ args, query }) {
        const r = await query(args)
        return decryptRecord("estimateHeader", r)
      },
      async findMany({ args, query }) {
        const r = await query(args)
        return Array.isArray(r) ? r.map((x: any) => decryptRecord("estimateHeader", x)) : r
      },
    },
    directDelivery: {
      async create({ args, query }) {
        if (args.data) args.data = encryptFields("directDelivery", args.data) as any
        return query(args)
      },
      async update({ args, query }) {
        if (args.data) args.data = encryptFields("directDelivery", args.data) as any
        return query(args)
      },
      async findFirst({ args, query }) {
        const r = await query(args)
        return decryptRecord("directDelivery", r)
      },
      async findMany({ args, query }) {
        const r = await query(args)
        return Array.isArray(r) ? r.map((x: any) => decryptRecord("directDelivery", x)) : r
      },
    },
  },
}) as unknown as PrismaClient

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma
}
