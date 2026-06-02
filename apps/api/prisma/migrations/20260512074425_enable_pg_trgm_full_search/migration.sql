-- Cycle 15-1a / FR-090, FR-092 — 전문 검색 인프라.
-- pg_trgm는 trigram 기반 유사도 매칭 extension. GIN 인덱스를 trigram_ops로
-- 만들면 ILIKE '%...%' 쿼리도 인덱스로 처리되어 대용량 페이지에서 seq scan
-- 회피. 한국어 NFC도 그대로 매칭됨(글자 단위 trigram).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Page_title_trgm_idx"
  ON "Page" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Page_content_trgm_idx"
  ON "Page" USING GIN ("content" gin_trgm_ops);
