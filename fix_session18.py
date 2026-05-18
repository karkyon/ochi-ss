#!/usr/bin/env python3
"""
fix_session18.py
================
TASK A: EstimateNewClient — 未使用 router を削除（tsc警告抑制）
TASK B: POST /api/v1/estimates — 保存後 estimateStatus を "saved" に変更（"draft"→"saved"）
TASK C: /estimates/[id]/edit 保存成功後 — router.push でページリロードせず saveMessage のみ表示
TASK D: /orders/[id] page — 注文ステータスバッジ表示改善
TASK E: E2Eテスト用シードデータスクリプト生成
"""

import subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def read(p): return (ROOT / p).read_text(encoding="utf-8")
def write(p, c):
    path = ROOT / p; path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(c, encoding="utf-8"); print(f"  ✅ 書込: {p}")

def rep(p, old, new, label):
    path = ROOT / p
    if not path.exists(): print(f"  ⚠️  [{label}] 未存在"); return False
    c = path.read_text(encoding="utf-8")
    if old not in c: print(f"  ❌ [{label}] アンカー未発見"); return False
    path.write_text(c.replace(old, new, 1), encoding="utf-8"); print(f"  ✅ [{label}]"); return True

# ============================================================
# TASK A: EstimateNewClient 未使用 router 削除
# ============================================================
def task_a():
    print("\n[TASK A] EstimateNewClient 未使用 router 削除")
    path = "src/app/(app)/estimates/new/EstimateNewClient.tsx"
    content = read(path)

    # router の使用箇所を確認
    uses = [l for l in content.split("\n") if "router" in l and not l.strip().startswith("//")]
    print(f"  router 使用箇所: {len(uses)}行")
    for u in uses[:5]:
        print(f"    {u.strip()[:80]}")

    if len(uses) <= 1:  # import行のみなら削除
        rep(path,
            "  const router = useRouter()\n",
            "",
            "router宣言削除"
        )
        # useRouter import も不要なら削除
        content2 = read(path)
        if "useRouter" not in content2.replace("import { useRouter", ""):
            rep(path,
                "import { useRouter } from \"next/navigation\"\n",
                "",
                "useRouter import削除"
            )
    else:
        print("  ℹ️  router は他の箇所でも使用中 — スキップ")

# ============================================================
# TASK B: POST /api/v1/estimates 保存後ステータス "draft"→"saved"
# ============================================================
def task_b():
    print("\n[TASK B] POST /api/v1/estimates estimateStatus draft→saved")
    rep(
        "src/app/api/v1/estimates/route.ts",
        "estimateStatus:  \"draft\",",
        "estimateStatus:  \"saved\",",
        "estimateStatus draft→saved"
    )

# ============================================================
# TASK C: /orders page.tsx — statusLabelMap に "pending" etc 追加
# ============================================================
def task_c():
    print("\n[TASK C] /orders page.tsx statusLabelMap 確認・追加")
    path = "src/app/(app)/orders/page.tsx"
    if not (ROOT / path).exists():
        print("  ⚠️  未存在")
        return
    content = read(path)
    if "pending" in content and "処理中" in content:
        print("  ✅ statusLabelMap 既に完備")
        return

    # STATUS_LABEL マップを追加
    rep(path,
        "export default async function",
        '''\
const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:     { label: "処理中",   color: "bg-amber-100 text-amber-700" },
  confirmed:   { label: "確定",     color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "製造中",   color: "bg-indigo-100 text-indigo-700" },
  shipped:     { label: "出荷済",   color: "bg-purple-100 text-purple-700" },
  completed:   { label: "完了",     color: "bg-emerald-100 text-emerald-700" },
  cancelled:   { label: "取消",     color: "bg-red-100 text-red-600" },
}

export default async function''',
        "orders STATUS_LABEL追加"
    )
    # statusLabelMap={STATUS_LABEL} を渡しているか確認
    content2 = read(path)
    if "statusLabelMap" not in content2:
        rep(path,
            "<OrdersClient",
            "<OrdersClient\n        statusLabelMap={STATUS_LABEL}",
            "statusLabelMap prop追加"
        )

# ============================================================
# TASK D: E2Eテスト用 seed スクリプト生成
# ============================================================
def task_d():
    print("\n[TASK D] E2Eテスト用 seed スクリプト生成")
    write("scripts/seed-test-data.ts", '''\
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

  console.log("\\n🎉 テストデータ投入完了")
  console.log("\\nログイン情報:")
  console.log("  企業コード: 99999")
  console.log("  ユーザーID: testuser")
  console.log("  パスワード: test1234")
}

main()
  .catch(e => { console.error("❌ エラー:", e); process.exit(1) })
  .finally(() => prisma.$disconnect())
''')

# ============================================================
# TASK E: E2Eテスト チェックリスト Markdown 生成
# ============================================================
def task_e():
    print("\n[TASK E] E2Eテストチェックリスト生成")
    write("docs/e2e-checklist.md", '''\
# E2E テストチェックリスト

最終更新: 2026-05-18  
対象コミット: 2ebd485〜

## 事前準備

```bash
# Docker 起動
cd ~/projects/ochi-ss/docker && docker compose up -d postgres redis

# テストデータ投入
cd ~/projects/ochi-ss
npx ts-node scripts/seed-test-data.ts

# 開発サーバ起動
npm run dev
# → https://192.168.1.11:3033
```

---

## テスト項目

### 1. 認証フロー

| # | 操作 | 期待結果 | ✅/❌ |
|---|------|---------|------|
| 1-1 | `/login` にアクセス | ログイン画面表示 | |
| 1-2 | 企業コード:99999 / ユーザーID:testuser / PW:test1234 でログイン | `/dashboard` へリダイレクト | |
| 1-3 | 未認証で `/dashboard` にアクセス | `/login` へリダイレクト | |
| 1-4 | ヘッダーの「ログアウト」→ 確認ダイアログ → ログアウト | `/login` へ遷移 | |

### 2. 見積新規作成フロー

| # | 操作 | 期待結果 | ✅/❌ |
|---|------|---------|------|
| 2-1 | `/estimates/new` にアクセス | 見積入力画面表示 | |
| 2-2 | 入力日付・材料・加工仕様・寸法T/A/B・数量を入力 | フォームに値が入る | |
| 2-3 | 「標準公差」ボタン | 公差フィールドに値が入る | |
| 2-4 | 「見積計算」ボタン | 単価・合計・最短納期・有効期限が表示される | |
| 2-5 | 「明細に追加」ボタン | 明細テーブルに行が追加される | |
| 2-6 | 「💾 保存」ボタン | 「見積を保存しました（見積No: W2026...）」メッセージ + 「🛒 注文する」ボタン表示 | |
| 2-7 | 「🛒 注文する」ボタン | `/orders/confirm?estimateId=...` に遷移 | |

### 3. 見積編集フロー

| # | 操作 | 期待結果 | ✅/❌ |
|---|------|---------|------|
| 3-1 | 見積一覧から「編集」| `/estimates/[id]/edit` に遷移 | |
| 3-2 | 編集画面ロード時 | 期限切れ明細がある場合アラート表示 | |
| 3-3 | 保存 | 「見積を更新しました」メッセージ | |
| 3-4 | 「🛒 注文する」ボタン | `/orders/confirm?estimateId=...` に遷移 | |

### 4. 注文確認・完了フロー

| # | 操作 | 期待結果 | ✅/❌ |
|---|------|---------|------|
| 4-1 | `/orders/confirm?estimateId=...` | 明細テーブル・合計額表示 | |
| 4-2 | 期限切れ明細がある場合 | アンバー警告バナー + 注文ボタン無効 | |
| 4-3 | 「🛒 注文を確定する」ボタン | POST `/api/v1/orders` が成功し `/orders/complete` へ遷移 | |
| 4-4 | `/orders/complete` | 注文No（Z2026...）が表示される | |
| 4-5 | 「注文詳細を確認」ボタン | `/orders/[id]` に遷移 | |

### 5. 見積一覧・注文一覧

| # | 操作 | 期待結果 | ✅/❌ |
|---|------|---------|------|
| 5-1 | `/estimates` 検索 | 見積一覧表示・ページネーション | |
| 5-2 | 一覧の「🛒 注文」ボタン | `/orders/confirm?estimateId=...` に遷移 | |
| 5-3 | 一覧の「見積書」ボタン | 別タブでHTML見積書表示 | |
| 5-4 | `/orders` 検索 | 注文一覧表示 | |
| 5-5 | `/orders/[id]` | 注文詳細・明細・ステータス履歴表示 | |

### 6. マスタ管理

| # | 操作 | 期待結果 | ✅/❌ |
|---|------|---------|------|
| 6-1 | `/masters/direct-delivery` | 直送先一覧表示 | |
| 6-2 | 新規登録 → 保存 | 一覧に追加される | |
| 6-3 | 編集 → 保存 | 変更が反映される | |
| 6-4 | 削除 | 一覧から消える | |

### 7. お知らせ

| # | 操作 | 期待結果 | ✅/❌ |
|---|------|---------|------|
| 7-1 | `/notifications` | お知らせ一覧（空でも「現在お知らせはありません」） | |
| 7-2 | フィルタ（重要/緊急） | 絞り込み結果表示 | |

### 8. セキュリティ

| # | 操作 | 期待結果 | ✅/❌ |
|---|------|---------|------|
| 8-1 | DevTools Network → レスポンスヘッダー確認 | `X-Frame-Options: DENY` 等が含まれる | |
| 8-2 | `/masters/chamfer-rules` に User ロールでアクセス | `/access-denied` にリダイレクト | |

---

## バグ報告テンプレート

```
【画面URL】
【操作手順】
【期待結果】
【実際の結果】
【エラーメッセージ/スクショ】
【ブラウザ/DevToolsのコンソールエラー】
```
''')

# ============================================================
# メイン
# ============================================================
def main():
    print("=" * 60)
    print("fix_session18.py 開始")
    print("=" * 60)
    task_a()
    task_b()
    task_c()
    task_d()
    task_e()

    print("\n→ tscチェック中...")
    result = subprocess.run(["npx", "tsc", "--noEmit"], capture_output=True, text=True, cwd=str(ROOT))
    if result.returncode != 0:
        print("❌ tscエラー:")
        print((result.stdout + result.stderr)[-6000:])
        sys.exit(1)

    print("✅ tscエラーなし → git add & push")
    subprocess.run(["git", "add", "-A"], check=True, cwd=str(ROOT))
    subprocess.run(["git", "commit", "-m",
        "feat: estimateStatus saved/orderStatus labels/E2Eチェックリスト/seedスクリプト"],
        check=True, cwd=str(ROOT))
    subprocess.run(["git", "push"], check=True, cwd=str(ROOT))
    print("✅ push完了")

if __name__ == "__main__":
    main()
