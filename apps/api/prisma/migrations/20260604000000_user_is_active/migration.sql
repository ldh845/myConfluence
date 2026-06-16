-- Cycle L2 (feature/ldh) — 계정 활성/비활성 컬럼.
-- 기존 사용자는 전원 활성(default true). 비활성 계정은 로컬/OIDC 로그인 및
-- 기존 docspace_session(jwt.strategy) 모두 거부된다.
-- AlterTable
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
