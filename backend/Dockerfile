# ─────────────────────────────────────────────────────────────
# Multi-stage build for the EPTA NestJS backend.
# ─────────────────────────────────────────────────────────────

# 1. Dependencies — install everything (incl. dev) for the build.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# 2. Build — compile TypeScript and generate the Prisma client.
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Compile the app, then compile the standalone seed script to plain JS so it can
# run in the prod image with `node` (no ts-node in the runtime layer).
RUN npx prisma generate \
 && npm run build \
 && npx tsc prisma/seed.ts --outDir dist --rootDir . \
      --module commonjs --target es2022 --moduleResolution node \
      --esModuleInterop --skipLibCheck

# 3. Production deps only.
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

# 4. Runner — minimal final image.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Run as the non-root user that ships with the node image.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./
USER node
EXPOSE 3000
# `prisma migrate deploy` is invoked from compose/entrypoint, not baked here,
# so the image stays environment-agnostic.
CMD ["node", "dist/main"]
