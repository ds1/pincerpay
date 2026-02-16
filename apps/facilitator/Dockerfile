FROM node:22-slim AS base
RUN npm install -g pnpm@10

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/facilitator/package.json ./apps/facilitator/
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/facilitator/node_modules ./apps/facilitator/node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY . .
RUN pnpm --filter @pincerpay/core build
RUN pnpm --filter @pincerpay/db build \
    && grep -q 'schema/index.js' packages/db/dist/index.js \
    || (echo 'ASSERT FAILED: db/dist/index.js missing .js extensions' && cat packages/db/dist/index.js && exit 1)
RUN pnpm --filter @pincerpay/facilitator build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS=--dns-result-order=ipv4first
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/facilitator/node_modules ./apps/facilitator/node_modules
COPY --from=builder /app/apps/facilitator/dist ./apps/facilitator/dist
COPY --from=builder /app/apps/facilitator/package.json ./apps/facilitator/
COPY --from=builder /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/

EXPOSE 4402
CMD ["node", "apps/facilitator/dist/index.js"]
