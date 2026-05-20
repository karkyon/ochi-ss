// scripts/cleanup-expired-drafts.ts
// 有効期限切れ Draft のソフトデリートバッチ
//
// 実行方法:
//   npx ts-node --project tsconfig.json scripts/cleanup-expired-drafts.ts
//
// cron（毎日0時）:
//   0 0 * * * cd /app && npx ts-node scripts/cleanup-expired-drafts.ts >> /var/log/cleanup-drafts.log 2>&1

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const now = new Date()
  console.log(`[cleanup-expired-drafts] 開始: ${now.toISOString()}`)

  const result = await prisma.estimateHeader.updateMany({
    where: {
      estimateStatus: "draft",
      isDraftOnly:    true,
      isDeleted:      false,
      draftExpiresAt: { lt: now },
    },
    data: { isDeleted: true },
  })

  console.log(`[cleanup-expired-drafts] ソフトデリート件数: ${result.count}`)
  console.log(`[cleanup-expired-drafts] 完了: ${new Date().toISOString()}`)
}

main()
  .catch((e) => {
    console.error("[cleanup-expired-drafts] エラー:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
