# Cycle 42 — NestJS(API + Hocuspocus) 멀티스테이지 이미지.
# build context 는 저장소 루트(.)다. npm workspaces 모노레포라
# 루트 lockfile + 두 워크스페이스 package.json 으로 의존성을 설치한다.
#
# 빌드·런타임 둘 다 full node:22-bookworm. 빌드는 네이티브 모듈 컴파일 도구가
# 필요하고, 런타임은 Prisma 쿼리/마이그레이션 엔진이 시스템 OpenSSL(libssl)을
# 동적 링크하는데 slim 이미지엔 libssl 이 없어 엔진이 무한 대기한다. 이미지 크기
# 최적화는 AFS production 이미지에서 별도로 다룬다.

# ---- deps + build ----
# node:22 — 의존성(@hocuspocus/server, chevrotain)이 node>=22 를 요구한다
# (Cycle 42: node20 → node22 상향).
FROM node:22-bookworm AS build
WORKDIR /app

# 사내 프록시 환경 빌드(Cycle 42 followup).
# (1) 프록시: HTTP_PROXY/HTTPS_PROXY/NO_PROXY 는 Docker predefined build arg 라
#     --build-arg 로 주면 빌드 RUN(npm ci 등)에 자동 적용된다. 명시 선언해 의도를
#     분명히 한다. compose 가 빌드 호스트 env 에서 전달(값 하드코딩 금지).
# ARG HTTP_PROXY
# ARG HTTPS_PROXY
# ARG NO_PROXY
# (2) 사내 root CA: 프록시 SSL inspection 을 신뢰하려면 빌드 컨테이너가 사내 CA 를
#     믿어야 한다. ca-certs/ 의 *.crt 를 시스템 신뢰 저장소에 등록.
#     ca-certs/ 가 비어도(.gitkeep 만) 빌드는 안 깨진다(|| true). node 는 시스템 CA
#     번들을 자동으로 안 보므로 NODE_EXTRA_CA_CERTS 지정이 필수.
# COPY ca-certs/ /tmp/ca-certs/
# RUN cp /tmp/ca-certs/*.crt /usr/local/share/ca-certificates/ 2>/dev/null || true; \
    # update-ca-certificates || true
# ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

ARG NEXUS_NPM_URL
ARG PRISMA_URL
ENV PRISMA_ENGINES_MIRROR=${PRISMA_URL}
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

# workspaces 의존성 설치 — 루트 lockfile + 각 워크스페이스 manifest 필요.
# 위 프록시/CA 가 없으면 EAI_AGAIN(또는 npm 이 "Exit handler never called!" 로
# 오역) 으로 실패한다. 자세히는 docs/DEPLOY.md "사내 프록시 환경에서 빌드" 참조.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
# COPY apps/web/package.json apps/web/package.json
# RUN npm ci
RUN npm config set registry ${NEXUS_NPM_URL} && \ 
    npm config set strict-ssl false && \ 
    npm ci

# api 소스 복사 후 Prisma client 생성 → 컴파일.
# npm workspaces 는 워크스페이스(apps/api) 의존성의 실행 바이너리(nest/prisma)를
# 해당 워크스페이스의 node_modules/.bin 에 링크한다(패키지 본체만 루트로 hoist).
# 따라서 워크스페이스 .bin 을 루트 .bin 보다 앞에 PATH 에 넣고 직접 호출한다.
# (`npm --prefix` 방식은 컨테이너에서 PATH 가 안 잡혀 127 실패)
# 순서 주의: @prisma/client 가 먼저 생성돼야 nest build 가 그 타입을 안다.
COPY apps/api apps/api
ENV PATH=/app/apps/api/node_modules/.bin:/app/node_modules/.bin:$PATH
RUN cd apps/api && prisma generate && nest build

# ---- runtime ----
FROM node:22-bookworm AS runtime
WORKDIR /app

# 의존성(Prisma CLI/엔진 포함)과 빌드 산출물, 마이그레이션 SQL 을 가져온다.
# 일부 의존성만 루트 node_modules 로 hoist 되고, 나머지(prisma·@prisma/client·
# @nestjs/* 등 상당수)는 apps/api/node_modules 에 남는다. 따라서 두 디렉터리를
# 모두 복사해야 prisma CLI 와 런타임 require 가 성립한다.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api

# Cycle 46 — production 모드 명시 (web Dockerfile 정합). NestJS·관련 패키지가
# dev/prod 분기 동작(에러 상세도, 로깅 등)을 NODE_ENV 로 결정한다.
ENV NODE_ENV=production
# Cycle 40 포트 컨벤션 — NestJS REST. Hocuspocus 협업 서버는 같은 프로세스 :1234.
ENV PORT=3001
EXPOSE 3001 1234

# 기동 시 마이그레이션 적용 후 서버 시작. nest-cli sourceRoot=src 라 엔트리는 dist/src/main.
# WORKDIR=/app/apps/api 라 node_modules/.bin/prisma 는 apps/api 워크스페이스 bin.
# npx(못 찾으면 다운로드 시도→무한 대기) 대신 bin 을 직접 호출한다.
# 변경 전
# CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/src/main"]

# 변경 후
COPY apps/api/entrypoint.sh /app/apps/api/entrypoint.sh
RUN chmod +x /app/apps/api/entrypoint.sh
ENTRYPOINT ["/app/apps/api/entrypoint.sh"]