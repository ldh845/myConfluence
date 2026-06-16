-- Cycle L3 (feature/ldh) — 로컬 로그인 brute-force 잠금 컬럼.
-- failedLoginCount: 연속 오답 횟수(성공/잠금 시 0 리셋). 기존 사용자 0.
-- lockedUntil: 잠금 만료 시각(nullable). 미래면 로컬 로그인 423 거부.
-- AlterTable
ALTER TABLE "User" ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockedUntil" TIMESTAMP(3);
