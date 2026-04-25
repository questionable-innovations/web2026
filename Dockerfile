# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.27.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

FROM base AS build
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_CHAIN_ID
ARG NEXT_PUBLIC_RPC_URL
ARG NEXT_PUBLIC_ESCROW_FACTORY
ARG NEXT_PUBLIC_CONTRACT_REGISTRY
ARG NEXT_PUBLIC_DEPOSIT_TOKEN
ARG NEXT_PUBLIC_DEPOSIT_TOKEN_SYMBOL
ARG NEXT_PUBLIC_DEPOSIT_TOKEN_DECIMALS
ARG NEXT_PUBLIC_PRIVY_APP_ID
ARG NEXT_PUBLIC_IPFS_GATEWAY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_CHAIN_ID=$NEXT_PUBLIC_CHAIN_ID \
    NEXT_PUBLIC_RPC_URL=$NEXT_PUBLIC_RPC_URL \
    NEXT_PUBLIC_ESCROW_FACTORY=$NEXT_PUBLIC_ESCROW_FACTORY \
    NEXT_PUBLIC_CONTRACT_REGISTRY=$NEXT_PUBLIC_CONTRACT_REGISTRY \
    NEXT_PUBLIC_DEPOSIT_TOKEN=$NEXT_PUBLIC_DEPOSIT_TOKEN \
    NEXT_PUBLIC_DEPOSIT_TOKEN_SYMBOL=$NEXT_PUBLIC_DEPOSIT_TOKEN_SYMBOL \
    NEXT_PUBLIC_DEPOSIT_TOKEN_DECIMALS=$NEXT_PUBLIC_DEPOSIT_TOKEN_DECIMALS \
    NEXT_PUBLIC_PRIVY_APP_ID=$NEXT_PUBLIC_PRIVY_APP_ID \
    NEXT_PUBLIC_IPFS_GATEWAY=$NEXT_PUBLIC_IPFS_GATEWAY
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
RUN pnpm --filter web build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone output bundles a minimal server.js + only the deps it needs.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
