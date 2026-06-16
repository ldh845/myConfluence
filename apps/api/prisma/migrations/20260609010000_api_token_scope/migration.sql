-- Cycle L-API-3 (feature/ldh) — API 토큰 스코프(READ / READ_WRITE).
--   기존 토큰은 DEFAULT 'READ_WRITE' 로 백필 → 종전 동작 100% 보존.

-- CreateEnum
CREATE TYPE "ApiTokenScope" AS ENUM ('READ', 'READ_WRITE');

-- AlterTable
ALTER TABLE "ApiToken" ADD COLUMN "scope" "ApiTokenScope" NOT NULL DEFAULT 'READ_WRITE';
