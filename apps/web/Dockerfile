# Cycle 42 — Next.js 14 standalone 이미지.
# build context 는 저장소 루트(.)다. next.config.mjs 의 output:'standalone'
# 과 outputFileTracingRoot(=저장소 루트) 설정에 의존한다.
#
# 주의(빌드타임 주입): Next 는 rewrites() 와 NEXT_PUBLIC_* 를 빌드 시점에
# 평가/주입한다. 따라서 프록시 호스트(API_HOST)와 WS 주소(NEXT_PUBLIC_WS_URL)
# 는 ENV 가 아니라 빌드 ARG 로 받아 굽는다. 다른 환경(AFS 등)으로 갈 때는
# 해당 ARG 값만 바꿔 재빌드한다.

# ---- build ----
# node:22 — 의존성이 node>=22 를 요구한다 (Cycle 42: node20 → node22 상향).
FROM node:22-bookworm AS build
WORKDIR /app

# 사내 프록시 환경 빌드(Cycle 42 followup) — api Dockerfile 과 동일.
# (1) 프록시 predefined build arg 명시 선언(compose 가 빌드 호스트 env 에서 전달).
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
# (2) 사내 root CA 주입(ca-certs/*.crt). 비어도 안 깨짐. node 용 NODE_EXTRA_CA_CERTS 필수.
COPY ca-certs/ /tmp/ca-certs/
RUN cp /tmp/ca-certs/*.crt /usr/local/share/ca-certificates/ 2>/dev/null || true; \
    update-ca-certificates || true
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

# workspaces 의존성 설치. 위 프록시/CA 없으면 EAI_AGAIN 으로 실패.
# 자세히는 docs/DEPLOY.md "사내 프록시 환경에서 빌드" 참조.
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

# npm workspaces 는 워크스페이스(apps/web) 의존성의 실행 바이너리(next)를 해당
# 워크스페이스의 node_modules/.bin 에 링크한다(패키지 본체만 루트로 hoist).
# 따라서 워크스페이스 .bin 을 루트 .bin 보다 앞에 PATH 에 넣고 직접 호출한다
# (api Dockerfile 과 동일 패턴, hoist 결과에 의존하지 않음).
ENV PATH=/app/apps/web/node_modules/.bin:/app/node_modules/.bin:$PATH
RUN cd apps/web && next build

# ---- runtime ----
FROM node:22-bookworm-slim AS runtime
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
