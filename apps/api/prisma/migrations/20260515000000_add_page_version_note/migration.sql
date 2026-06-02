-- Cycle 34 — PageVersion.note. 발행 시 사용자 변경 코멘트.
-- update / restore 경로에는 수집 UI가 없어 항상 NULL.

ALTER TABLE "PageVersion" ADD COLUMN IF NOT EXISTS "note" TEXT;
