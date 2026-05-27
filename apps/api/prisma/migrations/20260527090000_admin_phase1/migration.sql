-- Cycle 48 Phase 1 — 관리자 페이지 기반.
-- (1) User 확장: Keycloak claim 캐시(email, emailVerified, lastLoginAt).
--     OIDC callback 이 매 로그인마다 동기화한다.
ALTER TABLE "User" ADD COLUMN "email" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- (2) AppConfig: 시스템 설정 single-row (id="singleton").
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "siteName" TEXT NOT NULL DEFAULT 'DocSpace',
    "uploadLimitMb" INTEGER NOT NULL DEFAULT 100,
    "sessionExpireMin" INTEGER NOT NULL DEFAULT 10080,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

-- (3) singleton 행 seed (Admin 페이지가 빈 DB 에서도 즉시 동작).
INSERT INTO "AppConfig" ("id", "updatedAt") VALUES ('singleton', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
