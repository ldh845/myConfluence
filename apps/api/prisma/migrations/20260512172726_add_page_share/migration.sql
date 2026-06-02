-- FR-120 (Cycle 23) — 페이지 공유 링크.
-- 토큰 보유자에게 읽기 전용 접근. revokedAt이 null이면 활성.

CREATE TABLE IF NOT EXISTS "PageShare" (
  "id"        TEXT NOT NULL,
  "pageId"    TEXT NOT NULL,
  "token"     TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "PageShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PageShare_token_key"
  ON "PageShare" ("token");

CREATE INDEX IF NOT EXISTS "PageShare_pageId_idx"
  ON "PageShare" ("pageId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'PageShare_pageId_fkey'
      AND table_name = 'PageShare'
  ) THEN
    ALTER TABLE "PageShare"
      ADD CONSTRAINT "PageShare_pageId_fkey"
      FOREIGN KEY ("pageId") REFERENCES "Page"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
