# --- Stage Builder ---
FROM --platform=$BUILDPLATFORM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ openssl
COPY package*.json ./
COPY prisma ./prisma/
# Copy thêm file config vào builder để npx prisma generate nhận được
COPY prisma.config.ts ./ 

RUN npm install --legacy-peer-deps
COPY . .
RUN npx prisma generate
RUN npm run build

# --- Stage Run ---
FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy node_modules và các file build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
# QUAN TRỌNG: Copy file cấu hình Prisma vào đây
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

EXPOSE 3002

# Nếu dùng prisma.config.ts, Prisma cần biến môi trường DATABASE_URL có sẵn trong Shell
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]

RUN ls -R dist