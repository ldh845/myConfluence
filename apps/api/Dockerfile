# Cycle 42 — NestJS(API + Hocuspocus) 멀티스테이지 이미지.
# build context 는 저장소 루트(.)다. npm workspaces 모노레포라
# 루트 lockfile + 두 워크스페이스 package.json 으로 의존성을 설치한다.
#
# 빌드 스테이지는 full bookworm (bcrypt 등 네이티브 모듈 컴파일 도구 포함),
# 런타임은 slim 으로 줄인다. 둘 다 glibc(bookworm) 기반이라 .node 호환.

# ---- deps + build ----
# node:22 — 의존성(@hocuspocus/server, chevrotain)이 node>=22 를 요구한다
# (Cycle 42: node20 → node22 상향).
FROM node:22-bookworm AS build
WORKDIR /app

# workspaces 의존성 설치 — 루트 lockfile + 각 워크스페이스 manifest 필요.
# 주의: 컨테이너 빌드 안 npm 이 레지스트리에 닿아야 한다. 사내 프록시 환경에선
# 빌드 시 HTTP_PROXY/HTTPS_PROXY + 사내 root CA 주입 필요(없으면 EAI_AGAIN 로
# 실패하며 npm 이 "Exit handler never called!" 로 오역해 표시한다).
# 자세히는 docs/DEPLOY.md "컨테이너 개발 환경" 참조.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

# api 소스 복사 후 Prisma client 생성 → 컴파일.
# npm workspaces 는 실행 바이너리(nest/prisma)를 루트 node_modules/.bin 에
# 호이스트하므로 PATH 에 추가하고 워크스페이스 디렉토리에서 직접 호출한다.
# (`npm --prefix` 방식은 컨테이너에서 루트 .bin 을 PATH 에 못 넣어 127 실패)
# 순서 주의: @prisma/client 가 먼저 생성돼야 nest build 가 그 타입을 안다.
COPY apps/api apps/api
ENV PATH=/app/node_modules/.bin:$PATH
RUN cd apps/api && prisma generate && nest build

# ---- runtime ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

# 의존성(Prisma CLI/엔진 포함)과 빌드 산출물, 마이그레이션 SQL 을 가져온다.
# node_modules 는 루트로 호이스트되므로 루트에서 통째로 복사.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api

# Cycle 40 포트 컨벤션 — NestJS REST. Hocuspocus 협업 서버는 같은 프로세스 :1234.
ENV PORT=3001
EXPOSE 3001 1234

# 기동 시 마이그레이션 적용 후 서버 시작. nest-cli sourceRoot=src 라 엔트리는 dist/src/main.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
