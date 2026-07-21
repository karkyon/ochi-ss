# sync-service/Dockerfile
# Node.js 22 (Next.js本体と合わせる) + TypeScript(tsx) Worker
#
# ★2026/07/21 修正: ビルドコンテキストをリポジトリルートに変更したため、
#   ルートの prisma/schema.prisma を明示的にコピーしてから
#   npx prisma generate を実行するようにした。
#   (旧構成はコンテキストが sync-service/ 単体だったため schema.prisma が
#    存在せず、Prisma Clientが一度も生成されないまま起動していた)
FROM node:22-alpine

WORKDIR /app

# --- リポジトリルートのPrismaスキーマを取り込む ---
COPY prisma ./prisma

# --- sync-service本体の依存関係を先にインストール(キャッシュ効率化) ---
COPY sync-service/package*.json ./
RUN npm install --omit=dev

# --- sync-service本体のソースをコピー ---
COPY sync-service/ ./

# --- Prisma Client生成 ---
RUN npx prisma generate

ENV NODE_ENV=production
ENV TZ=Asia/Tokyo

CMD ["npx", "tsx", "src/index.ts"]
