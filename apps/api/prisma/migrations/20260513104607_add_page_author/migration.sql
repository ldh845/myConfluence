-- FR-001 / Cycle 27c — Page.authorId + lastEditorId.
-- 기존 페이지는 'legacy' 시스템 유저로 백필. user 삭제 시 SetNull.

INSERT INTO "User" (id, username, "passwordHash", name, department, role, "createdAt", "updatedAt")
VALUES (
  'legacy',
  'legacy',
  'NOT_LOGIN_DISABLED',
  '레거시',
  '시스템',
  'DEVELOPER',
  NOW(),
  NOW()
)
ON CONFLICT (username) DO NOTHING;

ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "authorId" TEXT;
ALTER TABLE "Page" ADD COLUMN IF NOT EXISTS "lastEditorId" TEXT;

UPDATE "Page" SET "authorId" = 'legacy' WHERE "authorId" IS NULL;
UPDATE "Page" SET "lastEditorId" = 'legacy' WHERE "lastEditorId" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Page_authorId_fkey' AND table_name = 'Page'
  ) THEN
    ALTER TABLE "Page"
      ADD CONSTRAINT "Page_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Page_lastEditorId_fkey' AND table_name = 'Page'
  ) THEN
    ALTER TABLE "Page"
      ADD CONSTRAINT "Page_lastEditorId_fkey"
      FOREIGN KEY ("lastEditorId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "Page_authorId_idx" ON "Page" ("authorId");
CREATE INDEX IF NOT EXISTS "Page_lastEditorId_idx" ON "Page" ("lastEditorId");
