# Ochi-ss Web Order System

越智製作所 Web 受注・見積管理システム（新システム）

---

## 目次

1. [システム概要](#1-システム概要)
2. [技術スタック](#2-技術スタック)
3. [ポート割り当て](#3-ポート割り当て)
4. [ディレクトリ構成](#4-ディレクトリ構成)
5. [開発環境セットアップ](#5-開発環境セットアップ)
6. [環境変数](#6-環境変数)
7. [Docker 操作リファレンス](#7-docker-操作リファレンス)
8. [Prisma 操作リファレンス](#8-prisma-操作リファレンス)
9. [Sync Service](#9-sync-service)
10. [SQL Server 連携](#10-sql-server-連携)
11. [セキュリティ注意事項](#11-セキュリティ注意事項)
12. [トラブルシューティング](#12-トラブルシューティング)

---

## 1. システム概要

| 項目 | 内容 |
|------|------|
| システム名 | 越智製作所 Web オーダーシステム（Ochi-ss） |
| 開発サーバ | Ubuntu 24.04 / 192.168.1.11 |
| プロジェクトルート | `~/projects/ochi-ss` |
| リポジトリ | karkyon/Ochi-ss（旧システムを破棄し新規再構築） |
| 本番環境 | Azure VPS 1本（Docker Compose 全サービス同居） |
| 業務システム連携 | Azure VPN Gateway 経由 → SQL Server（双方向 Sync） |

### アーキテクチャ概要

```
[ブラウザ]
    │ HTTPS
    ▼
[Caddy :8443]  ← リバースプロキシ + 自動TLS
    │
    ▼
[Next.js :3050]  ← フロントエンド + BFF
    │
    ├─ Prisma ──→ [PostgreSQL :5455]
    │
    ├─ HTTP ────→ [.NET 9 API :5050]  ← SQL Server SP呼び出し専用
    │                   │
    │              VPN Gateway
    │                   │
    │              [SQL Server]  ← 業務システム（ACCESS/adp接続）
    │
    └─ BullMQ ──→ [Redis :6479]
                      │
               [Sync Service]  ← 双方向データ同期ワーカー
                      │
                 VPN Gateway
                      │
                 [SQL Server]
```

### SQL Server との双方向同期フロー

```
■ Web → 業務（Transactional Outbox Pattern）
  Next.js API
    └─ Prisma transaction
        ├─ orders INSERT
        └─ outbox_events INSERT（同一トランザクション）
             ↓ 5秒間隔ポーリング
        Sync Worker（BullMQ）
             ↓
        SQL Server: WEBデータ確認 UPSERT
             ↓
        ACCESSフォームで担当者が確認 → 業務システムへ取り込み

■ 業務 → Web（Polling）
  ACCESSフォームで進捗・仕様変更入力
    └─ SQL Server: WEB進捗通知 INSERT
             ↓ 30秒間隔ポーリング
        Sync Worker
             ↓
        PostgreSQL: order_status_histories INSERT
        PostgreSQL: spec_change_histories INSERT
        PostgreSQL: orders.order_status UPDATE
        PostgreSQL: notifications INSERT（顧客への通知）
```

---

## 2. 技術スタック

| レイヤー | 技術 | バージョン | 備考 |
|---------|------|-----------|------|
| フロントエンド | Next.js | 15.x | App Router / RSC |
| UI | Tailwind CSS + shadcn/ui | latest | |
| 状態管理 | Zustand | 5.x | |
| 認証 | NextAuth.js v5（Auth.js） | beta | JWT + HttpOnly Cookie |
| ORM | Prisma | **6.x（固定）** | PostgreSQL ターゲット |
| DB（新システム） | PostgreSQL | 16.x | Docker コンテナ |
| キャッシュ/キュー | Redis | 7.x | BullMQ バックエンド |
| 同期サービス | Node.js + BullMQ | — | 独立コンテナ |
| バックエンド API | .NET 9 Web API | 9.x | SQL Server SP呼び出し専用 |
| DB（業務） | SQL Server | 2017+ | VPN経由・既存システム |
| リバースプロキシ | Caddy | 2.x | 自動HTTPS |
| インフラ | Docker Compose | v2 | |
| 言語 | TypeScript | 5.x | |

> ⚠️ **Prisma は 6.x に固定**  
> Prisma 7 は `schema.prisma` の `datasource.url` を廃止する破壊的変更あり。  
> `npm install prisma@^6 @prisma/client@^6` で固定済み。`package.json` の範囲指定を変えないこと。

---

## 3. ポート割り当て

開発サーバ（192.168.1.11）上では他プロジェクトとの競合を避けるため、  
標準ポートから **オフセット** して割り当てています。

| サービス | ホスト側ポート | コンテナ内ポート | 備考 |
|---------|-------------|--------------|------|
| PostgreSQL | **5455** | 5432 | 標準5432から+23 |
| Redis | **6479** | 6379 | 標準6379から+100 |
| Next.js | **3050** | 3000 | 標準3000から+50 |
| .NET 9 API | **5050** | 5000 | 標準5000から+50 |
| Caddy HTTP | **8080** | 80 | |
| Caddy HTTPS | **8443** | 443 | |

### 接続文字列（ローカル開発時）

```
PostgreSQL : postgresql://ochi_app:<PASS>@localhost:5455/ochi_ss
Redis      : redis://:<PASS>@localhost:6479
Next.js    : http://localhost:3050
.NET API   : http://localhost:5050
```

> **変更履歴**  
> 2026-05-13: 初期ポート（5432/6379/3000/5000/80/443）から変更。  
> 理由: 開発サーバ上の既存プロジェクト（fxde系など）との競合回避。

---

## 4. ディレクトリ構成

```
ochi-ss/
├── .env                          # Prisma用 DATABASE_URL（Git管理外）
├── .gitignore
├── README.md
│
├── prisma/
│   └── schema.prisma             # 全テーブル定義（Prisma 6.x）
│
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/
│   │   │   └── login/
│   │   ├── (main)/
│   │   │   ├── estimate/         # 見積入力
│   │   │   ├── order/            # 注文管理
│   │   │   └── dashboard/
│   │   └── api/                  # API Routes (BFF)
│   └── lib/
│       ├── crypto.ts             # AES-256-GCM 暗号化ユーティリティ
│       ├── prisma.ts             # Prisma Client シングルトン
│       └── auth.ts               # NextAuth.js 設定
│
├── docker/
│   ├── docker-compose.yml        # 全サービス定義
│   ├── .env                      # Docker Compose 用環境変数（Git管理外）
│   ├── .env.example              # 環境変数テンプレート（Git管理対象）
│   ├── Dockerfile.web            # Next.js イメージ
│   ├── Dockerfile.api            # .NET 9 API イメージ
│   ├── caddy/
│   │   └── Caddyfile
│   └── postgres/
│       └── init/                 # 初期化SQLスクリプト置き場（現在空）
│
└── sync-service/                 # 独立した Node.js プロジェクト
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts              # エントリーポイント
        ├── workers/
        │   ├── outbox.worker.ts  # Web→業務（Outbox Pattern）
        │   └── polling.worker.ts # 業務→Web（30秒ポーリング）
        └── db/
            ├── sqlserver.ts      # SQL Server 接続プール
            └── postgres.ts       # Prisma Client（sync-service用）
```

---

## 5. 開発環境セットアップ

### 前提条件

- Docker / Docker Compose v2
- Node.js v22.x
- npm v10.x

### 手順

```bash
# 1. リポジトリクローン
git clone https://github.com/karkyon/Ochi-ss.git
cd Ochi-ss

# 2. Next.js 依存パッケージインストール
npm install

# 3. Prisma を 6.x に固定（重要）
npm install prisma@^6 @prisma/client@^6

# 4. 環境変数設定
#    プロジェクトルート（Prisma用）
cp .env.example .env          # なければ手動作成
# DATABASE_URL を設定（ポート5455）
echo 'DATABASE_URL="postgresql://ochi_app:<PASS>@localhost:5455/ochi_ss"' > .env

#    Docker Compose 用
cp docker/.env.example docker/.env
# docker/.env の各値を設定（下記「環境変数」セクション参照）

# 5. Docker 起動（postgres + redis のみ先行起動）
cd docker
docker compose up -d postgres redis

# healthy 確認（STATUS が healthy になるまで待つ）
docker compose ps

# 6. Prisma マイグレーション
cd ..
npx prisma migrate dev --name init

# 7. Prisma Client 生成
npx prisma generate

# 8. 開発サーバ起動
npm run dev
# → http://localhost:3050 でアクセス
```

---

## 6. 環境変数

### `~/projects/ochi-ss/.env`（Prisma / Next.js 用）

```env
DATABASE_URL="postgresql://ochi_app:<POSTGRES_PASSWORD>@localhost:5455/ochi_ss"
```

### `~/projects/ochi-ss/docker/.env`（Docker Compose 用）

```env
# PostgreSQL
POSTGRES_PASSWORD=<強力なパスワード>

# Redis
REDIS_PASSWORD=<強力なパスワード>

# NextAuth.js
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=<openssl rand -base64 32>

# 暗号化キー（AES-256-GCM / HMAC）
ENCRYPTION_KEY=<openssl rand -hex 32>   # 64文字のhex
HMAC_KEY=<openssl rand -hex 32>         # 64文字のhex

# SQL Server（Azure VPN Gateway経由）
SQLSERVER_CONNECTION_STRING=Server=<host>,1433;Database=<db>;User Id=<user>;Password=<pass>;Encrypt=true;TrustServerCertificate=false;

# Sync Service ポーリング間隔
OUTBOX_POLL_INTERVAL_MS=5000    # Web→業務: 5秒
BIZPOLL_INTERVAL_MS=30000       # 業務→Web: 30秒
```

### キー生成コマンド

```bash
openssl rand -base64 32   # NEXTAUTH_SECRET
openssl rand -hex 32      # ENCRYPTION_KEY / HMAC_KEY（各64文字）
```

---

## 7. Docker 操作リファレンス

```bash
cd ~/projects/ochi-ss/docker

# 起動（開発時: postgres + redis のみ）
docker compose up -d postgres redis

# 全サービス起動（本番想定）
docker compose up -d

# 状態確認
docker compose ps

# ログ確認
docker compose logs -f postgres
docker compose logs -f redis
docker compose logs -f sync-service

# 停止（コンテナ保持）
docker compose stop

# 停止 + コンテナ削除
docker compose down

# 停止 + コンテナ + ボリューム削除（DB初期化）⚠️ データ消去
docker compose down -v

# コンテナ再起動
docker compose restart postgres
```

### 他プロジェクトとの共存

開発サーバ上には複数プロジェクトが稼働しています。  
**ochi-ss を起動する前に競合ポートを確認すること。**

```bash
# ポート使用状況確認
sudo ss -tlnp | grep -E "5455|6479|3050|5050"

# 競合している場合
docker ps | grep -E "5432|6379|3000|5000"
```

---

## 8. Prisma 操作リファレンス

```bash
cd ~/projects/ochi-ss

# マイグレーション作成 + 適用
npx prisma migrate dev --name <変更内容>

# 本番マイグレーション適用（マイグレーションファイルのみ実行）
npx prisma migrate deploy

# スキーマ変更をDBに直接反映（開発中の素早い確認用・マイグレーション履歴なし）
npx prisma db push

# Prisma Studio（GUIでDB参照）
npx prisma studio
# → http://localhost:5555

# Prisma Client 再生成（schema変更後に必須）
npx prisma generate

# マイグレーション履歴確認
npx prisma migrate status
```

> ⚠️ `prisma.config.ts` は **使用しない**（Prisma 7 方式）。  
> `schema.prisma` の `datasource.url = env("DATABASE_URL")` で管理。

---

## 9. Sync Service

`sync-service/` は Next.js とは独立した Node.js プロジェクトです。

```bash
cd ~/projects/ochi-ss/sync-service

# 依存パッケージ（初回）
npm install

# 開発起動
npm run dev

# ビルド
npm run build

# 本番起動
npm start
```

### Worker の役割

| Worker | 方向 | 間隔 | 処理 |
|--------|------|------|------|
| `outbox.worker.ts` | Web → 業務 | 5秒 | outbox_events を SQL Server WEBデータ確認 へ UPSERT |
| `polling.worker.ts` | 業務 → Web | 30秒 | WEB進捗通知 をポーリングし PostgreSQL へ反映 |

---

## 10. SQL Server 連携

### Web システムが操作するテーブル

| テーブル | 場所 | 操作 | 用途 |
|---------|------|------|------|
| WEBデータ確認 | SQL Server（既存） | UPSERT | 発注データを ACCESS フォームへ中継 |
| WEB進捗通知 | SQL Server（新規追加） | SELECT / UPDATE | 業務側の進捗・仕様変更を Web へ通知 |

### WEB進捗通知テーブル（SQL Server 側で要作成）

```sql
CREATE TABLE WEB進捗通知 (
  通知ID            UNIQUEIDENTIFIER  DEFAULT NEWID() PRIMARY KEY,
  WEB注文番号       NVARCHAR(50)      NOT NULL,
  通知種別          NVARCHAR(20)      NOT NULL,
  -- status_change / spec_change / delivery_update / tracking_update
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

### WEBデータ確認テーブルの実カラム確認（要対応）

```sql
-- SQL Server で実行してカラム定義を確認
SELECT
  COLUMN_NAME,
  DATA_TYPE,
  CHARACTER_MAXIMUM_LENGTH,
  IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = N'WEBデータ確認'
ORDER BY ORDINAL_POSITION;
```

結果を `sync-service/src/workers/outbox.worker.ts` の UPSERT クエリに反映させること。

---

## 11. セキュリティ注意事項

| 項目 | 方針 |
|------|------|
| `.env` ファイル | **絶対に Git にコミットしない**。`.gitignore` に記載済み |
| `ENCRYPTION_KEY` / `HMAC_KEY` | 64文字 hex。本番と開発で必ず別の値を使用 |
| パスワード | bcrypt コスト12。平文保存禁止 |
| 個人情報フィールド | 住所・TEL・FAX は AES-256-GCM で暗号化（`src/lib/crypto.ts`） |
| SQL Server 接続 | VPN Gateway 経由のみ。`Encrypt=true` 必須 |
| ポート公開 | PostgreSQL・Redis は `127.0.0.1` バインド（外部非公開） |
| Audit Trail | `sync_change_logs`・`order_status_histories`・`spec_change_histories` は削除禁止 |

---

## 12. トラブルシューティング

### Prisma: `datasource url is no longer supported`

Prisma 7 がインストールされている。6.x に固定する：

```bash
npm install prisma@^6 @prisma/client@^6
```

### Docker: `port is already allocated`

他プロジェクトのコンテナがポートを使用中：

```bash
# 使用中コンテナ確認
docker ps | grep -E "5432|6379|3000|5000"

# 競合コンテナを停止
docker stop <コンテナ名>

# または ochi-ss のポートを変更（docker-compose.yml を編集）
```

### Docker: `yaml: mapping key already defined`

`docker-compose.yml` に `volumes:` セクションが重複している。ファイルを直接編集して冒頭の重複を削除する。

### `docker compose ps` で postgres が `unhealthy`

```bash
# ログ確認
docker compose logs postgres

# よくある原因: POSTGRES_PASSWORD に特殊文字（/ + =）が含まれる場合
# docker/.env をクォートで囲む
POSTGRES_PASSWORD="your+password/here="
```

### Prisma Studio が起動しない

```bash
# ポート5555が使用中の可能性
npx prisma studio --port 5556
```

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-05-13 | 初版作成。DB設計・Docker構成・Sync Service 実装 |
| 2026-05-13 | Prisma 7→6 ダウングレード（破壊的変更回避） |
| 2026-05-13 | ポート変更（5432→5455, 6379→6479, 3000→3050, 5000→5050） |