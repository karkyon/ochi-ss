#!/usr/bin/env npx ts-node
/**
 * scripts/seed-test-data.ts
 * E2Eテスト用テストデータ投入スクリプト
 *
 * 実行: npx ts-node scripts/seed-test-data.ts
 */
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 テストデータ投入開始")

  // 1. テスト得意先
  const customer = await prisma.customer.upsert({
    where: { customerCode: "99999" },
    update: {},
    create: {
      customerCode:  "99999",
      customerName:  "テスト得意先株式会社",
      customerStatus: 1,
      loginEnabled:  true,
      sessionTimeoutMin: 140,
    },
  })
  console.log("✅ 得意先:", customer.customerCode, customer.customerName)

  // 2. テストユーザー
  const passwordHash = await bcrypt.hash("test1234", 12)
  const user = await prisma.user.upsert({
    where: { customerId_username: { customerId: customer.id, username: "testuser" } },
    update: { passwordHash },
    create: {
      customerId:   customer.id,
      username:     "testuser",
      passwordHash,
      chargeName:   "テスト担当者",
      userStatus:   1,
      userRole:     1,
    },
  })
  console.log("✅ ユーザー:", user.username, "/ パスワード: test1234")

  // 3. テスト直送先
  const dd = await prisma.directDelivery.upsert({
    where: { customerCode_deliveryCode: { customerCode: "99999", deliveryCode: "D001" } },
    update: {},
    create: {
      customerId:    customer.id,
      customerCode:  "99999",
      deliveryCode:  "D001",
      companyName:   "テスト納入先株式会社",
      departmentName: "購買部",
      contactPerson: "テスト担当",
      postalCode:    "530-0001",
      address1:      "大阪府大阪市北区梅田1-1-1",
      phoneNumber:   "06-1234-5678",
      faxNumber:     "06-1234-5679",
    },
  })
  console.log("✅ 直送先:", dd.deliveryCode, dd.companyName)

  // 4. テスト材料マスタ（なければ作成）
  const mat = await prisma.material.upsert({
    where: { materialCode: "SUS304" },
    update: {},
    create: {
      materialCode: "SUS304",
      materialName: "SUS304 ステンレス鋼",
    },
  })
  console.log("✅ 材料:", mat.materialCode)

  // 5. テスト加工仕様マスタ
  const spec = await prisma.processingSpec.upsert({
    where: { processingSpecCode: 1 },
    update: {},
    create: {
      processingSpecCode: 1,
      processingSpecName: "レーザー切断",
    },
  })
  console.log("✅ 加工仕様:", spec.processingSpecCode, spec.processingSpecName)

  console.log("\n🎉 テストデータ投入完了")
  console.log("\nログイン情報:")
  console.log("  企業コード: 99999")
  console.log("  ユーザーID: testuser")
  console.log("  パスワード: test1234")
}

main()
  .catch(e => { console.error("❌ エラー:", e); process.exit(1) })
  .finally(() => prisma.$disconnect())
