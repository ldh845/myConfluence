-- Cycle 43 — Keycloak OIDC 계정 매핑.
-- OIDC(SSO) 전용 사용자는 비밀번호가 없으므로 passwordHash 를 nullable 로.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Keycloak subject(sub) 저장 컬럼 + unique 인덱스 (OIDC 로그인 매핑 키).
ALTER TABLE "User" ADD COLUMN "keycloakId" TEXT;
CREATE UNIQUE INDEX "User_keycloakId_key" ON "User"("keycloakId");
