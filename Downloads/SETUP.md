# Ochi-ss セットアップ手順（STEP 1〜7）

**対象サーバ:** Ubuntu 24.04 / 192.168.1.11  
**プロジェクトルート:** `~/home/karkyon/projects/ochi-ss`

---

## STEP 1 — プロジェクト初期セットアップ

```bash
cd ~/home/karkyon/projects

# Next.js 15 プロジェクト作成
npx create-next-app@latest ochi-ss \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*"

cd ochi-ss

# Prisma 導入
npm install prisma @prisma/client
npx prisma init --datasource-provider postgresql

# 必須パッケージ
npm install next-auth@beta zustand
npm install bcryptjs
npm install --save-dev @types/bcryptjs

# Sync Service 用パッケージ（別ディレクトリで管理）
cd sync-service
npm install bullmq ioredis mssql @prisma/client
npm install --save-dev typescript @types/node ts-node
```

---

## STEP 2 — ディレクトリ構成の配置

```
ochi-ss/
├── docker/
│   ├── docker-compose.yml       ← 生成済みファイルを配置
│   ├── .env.example             ← コピーして .env を作成
│   ├── Dockerfile.web           ← 別途作成
│   ├── Dockerfile.api           ← 別途作成
│   └── caddy/
│       └── Caddyfile
├── prisma/
│   └── schema.prisma            ← 生成済みファイルを配置
├── src/
│   ├── lib/
│   │   └── crypto.ts            ← 生成済みファイルを配置
│   └── app/
└── sync-service/
    └── src/
        ├── index.ts
        ├── workers/
        │   ├── outbox.worker.ts
        │   └── polling.worker.ts
        └── db/
            └── sqlserver.ts
```

---

## STEP 3 — 環境変数設定

```bash
cd docker
cp .env.example .env
nano .env
```

設定が必要な値：
```
POSTGRES_PASSWORD=<強力なパスワード>
REDIS_PASSWORD=<強力なパスワード>
NEXTAUTH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)    # 64文字
HMAC_KEY=$(openssl rand -hex 32)          # 64文字
SQLSERVER_CONNECTION_STRING=Server=<VPN経由ホスト>,1433;Database=<DB名>;...
NEXTAUTH_URL=https://your-domain.com
```

---

## STEP 4 — Docker起動 & マイグレーション

```bash
# Docker Compose 起動（postgres + redis のみ先に起動）
cd docker
docker compose up -d postgres redis

# postgres が healthy になるのを待つ
docker compose ps

# Prisma マイグレーション実行
cd ..
DATABASE_URL="postgresql://ochi_app:<POSTGRES_PASSWORD>@localhost:5432/ochi_ss" \
  npx prisma migrate dev --name init

# Prisma Client 生成
npx prisma generate

# マイグレーション確認
DATABASE_URL="postgresql://ochi_app:<POSTGRES_PASSWORD>@localhost:5432/ochi_ss" \
  npx prisma studio
```

---

## STEP 5 — SQL Server 既存テーブル確認

SQL Server に接続して既存の WEBデータ確認テーブルのカラムを確認：

```sql
SELECT
  COLUMN_NAME,
  DATA_TYPE,
  CHARACTER_MAXIMUM_LENGTH,
  IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = N'WEBデータ確認'
ORDER BY ORDINAL_POSITION;
```

→ `DB_DESIGN_20260513.md` の「6.1 WEBデータ確認」と照合し、  
  `outbox.worker.ts` の UPSERT クエリを実際のカラム名に合わせて修正。

---

## STEP 6 — WEB進捗通知テーブル作成（SQL Server）

`DB_DESIGN_20260513.md` の「6.2 WEB進捗通知」の DDL を SQL Server で実行：

```sql
CREATE TABLE WEB進捗通知 (
  通知ID            UNIQUEIDENTIFIER  DEFAULT NEWID() PRIMARY KEY,
  WEB注文番号       NVARCHAR(50)      NOT NULL,
  通知種別          NVARCHAR(20)      NOT NULL,
  変更前ステータス  NVARCHAR(50),
  変更後ステータス  NVARCHAR(50),
  変更フィールド名  NVARCHAR(100),
  変更前値          NVARCHAR(500),
  変更後値          NVARCHAR(500),
  変更理由          NVARCHAR(1000),
  明細行番号        INT,
  送り状番号        NVARCHAR(100),
  担当者            NVARCHAR(100),
  発生日時          DATETIME          DEFAULT GETDATE(),
  WEB反映済フラグ   BIT               DEFAULT 0,
  WEB反映日時       DATETIME
);

CREATE INDEX IX_WEB進捗通知_注文番号 ON WEB進捗通知 (WEB注文番号);
CREATE INDEX IX_WEB進捗通知_未反映  ON WEB進捗通知 (WEB反映済フラグ, 発生日時);
```

---

## STEP 7 — 全サービス起動

```bash
cd docker
docker compose up -d
docker compose ps  # 全サービス healthy 確認
docker compose logs -f sync-service  # Sync Service ログ確認
```

---

## 確認チェックリスト

- [ ] `docker compose ps` で全サービスが Up/healthy
- [ ] `npx prisma studio` でテーブル確認
- [ ] `docker compose logs sync-service` でエラーなし
- [ ] SQL Server の WEB進捗通知テーブル作成完了
- [ ] WEBデータ確認テーブルのカラムを実物と照合済み
- [ ] `.env` が `.gitignore` に含まれていること

---

## .gitignore に追加すべき項目

```
.env
.env.local
.env.*.local
docker/.env
*.pem
*.key
```
