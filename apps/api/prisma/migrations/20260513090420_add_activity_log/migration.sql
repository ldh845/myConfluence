-- FR-131 (Cycle 24) — 활동 피드.
-- ON DELETE SET NULL: 페이지/스페이스 영구 삭제 후에도 로그 보존.

CREATE TABLE IF NOT EXISTS "ActivityLog" (
  "id"        TEXT NOT NULL,
  "type"      TEXT NOT NULL,
  "spaceId"   TEXT,
  "pageId"    TEXT,
  "actorName" TEXT,
  "payload"   JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx"
  ON "ActivityLog" ("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "ActivityLog_spaceId_createdAt_idx"
  ON "ActivityLog" ("spaceId", "createdAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ActivityLog_spaceId_fkey' AND table_name = 'ActivityLog'
  ) THEN
    ALTER TABLE "ActivityLog"
      ADD CONSTRAINT "ActivityLog_spaceId_fkey"
      FOREIGN KEY ("spaceId") REFERENCES "Space"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ActivityLog_pageId_fkey' AND table_name = 'ActivityLog'
  ) THEN
    ALTER TABLE "ActivityLog"
      ADD CONSTRAINT "ActivityLog_pageId_fkey"
      FOREIGN KEY ("pageId") REFERENCES "Page"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
