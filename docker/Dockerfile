# syntax=docker/dockerfile:1
# 任意の app をビルドする共通 Dockerfile（build arg APP で指定）。
# Next.js standalone 出力 + pnpm/Turborepo モノレポ対応。
# 例: docker build -f docker/Dockerfile --build-arg APP=golf -t spotomo-golf .

FROM node:20-alpine AS base
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /repo

# ---- 依存解決 + ビルド ----
FROM base AS builder
ARG APP
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* はビルド時にクライアントへ焼き込まれるため build arg で渡す
# （未指定なら空＝同一オリジンへフォールバック）。実行時のサーバ側は env_file が担う。
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_ACCOUNT_URL
ARG NEXT_PUBLIC_FACILITY_URL
ARG NEXT_PUBLIC_COOKIE_DOMAIN
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_ACCOUNT_URL=$NEXT_PUBLIC_ACCOUNT_URL \
    NEXT_PUBLIC_FACILITY_URL=$NEXT_PUBLIC_FACILITY_URL \
    NEXT_PUBLIC_COOKIE_DOMAIN=$NEXT_PUBLIC_COOKIE_DOMAIN \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
COPY . .
# pnpm ストアを BuildKit キャッシュに永続化し、ネットワーク不調（ERR_SOCKET_TIMEOUT）への
# 耐性と再ビルドの高速化を得る（依存を毎回 registry から再取得しない）。fetch のリトライ／
# タイムアウトも引き上げて初回の一過性タイムアウトに強くする。全 app ビルドで store を共有。
ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=10000 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_fetch_timeout=120000
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store
RUN pnpm turbo run build --filter=@spotomo/app-${APP}

# ---- 実行（最小イメージ） ----
FROM base AS runner
ARG APP
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /repo
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# standalone 出力（モノレポ構造ごと）+ 静的ファイル + public
COPY --from=builder --chown=nextjs:nodejs /repo/apps/${APP}/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/${APP}/.next/static ./apps/${APP}/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/${APP}/public ./apps/${APP}/public

USER nextjs
EXPOSE 3000
# server.js のパスを baked（APP は build arg）
ENV APP_SERVER=apps/${APP}/server.js
CMD ["sh", "-c", "node ${APP_SERVER}"]
