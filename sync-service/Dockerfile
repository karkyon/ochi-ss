# sync-service/Dockerfile
# Node.js 22 (Next.js本体と合わせる) + TypeScript(tsx) Worker
FROM node:22-alpine

WORKDIR /app

# 依存関係を先にインストール(キャッシュ効率化)
COPY package*.json ./
RUN npm install --omit=dev

# Prisma Client生成に必要な場合に備えてスキーマもコピー
# (sync-serviceが独自にPrisma Clientを生成する構成のため)
COPY . .

# Prisma Client生成(schema.prismaがsync-service配下にある場合のみ有効)
RUN if [ -f "prisma/schema.prisma" ]; then npx prisma generate; fi

ENV NODE_ENV=production
ENV TZ=Asia/Tokyo

CMD ["npx", "tsx", "src/index.ts"]
