-- FR-024 (Cycle 18-1a) — 페이지 휴지통 (soft delete).
-- deletedAt이 NULL이면 활성 페이지, 값 있으면 휴지통. 영구 삭제는 별도 endpoint.
-- 수동 패턴 (Cycle 17와 동일) — prisma migrate drift 회피.

ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Page_deletedAt_idx" ON "Page" ("deletedAt");
