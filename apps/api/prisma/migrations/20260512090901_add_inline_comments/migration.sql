-- FR-071 (Cycle 16-3a) — 인라인 댓글.
-- Comment 모델에 isInline / anchorJson / resolvedAt / resolvedBy 컬럼 추가.
-- 인라인+미해결 필터링 가속용 인덱스도 함께.
-- 수동 적용 마이그레이션 (Cycle 15-1a와 동일 패턴 — pg_trgm 인덱스가 schema에
-- 표현되지 않아 prisma migrate dev drift 회피 목적).

ALTER TABLE "Comment"
  ADD COLUMN "isInline"   BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN "anchorJson" TEXT,
  ADD COLUMN "resolvedAt" TIMESTAMP(3),
  ADD COLUMN "resolvedBy" TEXT;

CREATE INDEX IF NOT EXISTS "Comment_pageId_isInline_resolvedAt_idx"
  ON "Comment" ("pageId", "isInline", "resolvedAt");
