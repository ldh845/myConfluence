# Cycle 42 — Next.js 14 standalone 이미지.
# build context 는 저장소 루트(.)다. next.config.mjs 의 output:'standalone'
# 과 outputFileTracingRoot(=저장소 루트) 설정에 의존한다.
#
# 주의(빌드타임 주입): Next 는 rewrites() 와 NEXT_PUBLIC_* 를 빌드 시점에
# 평가/주입한다. 따라서 프록시 호스트(API_HOST)와 WS 주소(NEXT_PUBLIC_WS_URL)
# 는 ENV 가 아니라 빌드 ARG 로 받아 굽는다. 다른 환경(AFS 등)으로 갈 때는
# 해당 ARG 값만 바꿔 재빌드한다.

# ---- build ----
FROM node:20-bookworm AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm ci

COPY apps/web apps/web

# 빌드타임 주입 값 (compose 에서 build.args 로 전달)
ARG API_HOST=localhost
ARG API_PORT=3001
ARG NEXT_PUBLIC_WS_URL
ENV API_HOST=$API_HOST
ENV API_PORT=$API_PORT
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

RUN npm --prefix apps/web run build

# ---- runtime ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# standalone 출력은 outputFileTracingRoot 기준으로 저장소 구조를 미러링한다:
#   .next/standalone/{node_modules, apps/web/server.js, package.json}
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
