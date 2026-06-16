import subprocess, os, sys

ROOT = os.path.expanduser("~/projects/ochi-ss")
os.chdir(ROOT)

def run(cmd, check=True):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if check and r.returncode != 0:
        print(f"ERROR: {r.stdout}\n{r.stderr}")
        sys.exit(1)
    return r.stdout.strip()

print("=== add_dev_user.py ===")

# TypeScript経由でbcryptハッシュ生成してユーザー追加
TS_SCRIPT = r"""
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  // 企業コード 99999 の customer を取得（なければ作成）
  const customer = await prisma.customer.upsert({
    where: { customerCode: "99999" },
    update: {},
    create: {
      customerCode: "99999",
      customerName: "テスト得意先株式会社",
      customerStatus: 1,
      loginEnabled: true,
      sessionTimeoutMin: 140,
    },
  })
  console.log("customer:", customer.customerCode, customer.id)

  // karkyon / jun8206 追加（既存なら PW 更新）
  const hash = await bcrypt.hash("jun8206", 12)
  const user = await prisma.user.upsert({
    where: { customerId_username: { customerId: customer.id, username: "karkyon" } },
    update: { passwordHash: hash, userStatus: 1, accountLocked: false, loginFailCount: 0, lockedUntil: null },
    create: {
      customerId: customer.id,
      username: "karkyon",
      passwordHash: hash,
      chargeName: "開発者",
      userStatus: 1,
      userRole: 4,
    },
  })
  console.log("user:", user.username, "role:", user.userRole)
  console.log("DONE")
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
"""

script_path = f"{ROOT}/scripts/_add_dev_user.ts"
with open(script_path, "w", encoding="utf-8") as f:
    f.write(TS_SCRIPT)

print("[1] ユーザー追加実行...")
out = run(f"cd {ROOT} && npx ts-node --compiler-options '{{\"module\":\"commonjs\"}}' {script_path} 2>&1")
print(out)

if "DONE" not in out:
    print("エラー: ユーザー追加に失敗")
    os.remove(script_path)
    sys.exit(1)

# スクリプト削除
os.remove(script_path)
print("[2] 一時ファイル削除完了")
print()
print("✅ 完了!")
print("  企業コード: 99999")
print("  ユーザーID: karkyon")
print("  パスワード: jun8206")
print("  権限: SuperAdmin (role=4)")
