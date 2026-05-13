// =============================================================
//  src/lib/prisma.ts  （修正版 v2）
//
//  Prisma 6 変更点:
//    - $use（Middleware）は廃止 → $extends（Extensions）に移行
//    - crypto.ts の encryptionMiddleware は別途 $extends 対応が必要
//      現時点では暗号化を一時無効化し、後で $extends で実装
// =============================================================

import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  })

// ---------------------------------------------------------------
// ★ Prisma 6 では $use が廃止されました
//    暗号化は crypto.ts を $extends 方式で後日実装
//    暗号化が必要なフィールド（AES-256-GCM）:
//      EstimateHeader: destinationAddress, destinationTel, destinationFax
//      DirectDelivery: address1, address2, address3, phoneNumber, faxNumber
// ---------------------------------------------------------------
// TODO: prisma.$extends({ ... }) で暗号化を実装（STEP 後半で対応）

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
