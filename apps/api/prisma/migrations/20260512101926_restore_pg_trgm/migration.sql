-- FR-090 (Cycle 17) — pg_trgm 인덱스 회복.
-- 15-1a에서 추가했으나 16-1a 자동 마이그레이션이 schema drift로 인식해 DROP.
-- 이번 사이클에서 schema에 raw ops를 명시했으므로 향후 자동 DROP은 차단.
-- 모든 문장 idempotent — 인덱스가 이미 있으면 skip.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Page_title_trgm_idx"
  ON "Page" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Page_content_trgm_idx"
  ON "Page" USING GIN ("content" gin_trgm_ops);
