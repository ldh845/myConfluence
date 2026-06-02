-- Cycle 35 — Page.publishedAt. null이면 미발행 draft (사이드바 트리에서 숨김).
-- 기존 페이지는 모두 발행 상태로 간주 → createdAt으로 백필.

ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

UPDATE "Page" SET "publishedAt" = "createdAt" WHERE "publishedAt" IS NULL;
