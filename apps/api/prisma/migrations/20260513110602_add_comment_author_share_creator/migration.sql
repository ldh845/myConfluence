-- FR-001 / Cycle 27d — Comment.authorId + PageShare.createdById.
-- 기존 row는 'legacy' 시스템 유저로 백필. user 삭제 시 SetNull.

-- Cycle 27c에서 이미 'legacy' user가 INSERT됨 — idempotent 보장 차원에서 한번 더 시도.
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

ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "authorId" TEXT;
ALTER TABLE "PageShare" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

UPDATE "Comment" SET "authorId" = 'legacy' WHERE "authorId" IS NULL;
UPDATE "PageShare" SET "createdById" = 'legacy' WHERE "createdById" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Comment_authorId_fkey' AND table_name = 'Comment'
  ) THEN
    ALTER TABLE "Comment"
      ADD CONSTRAINT "Comment_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'PageShare_createdById_fkey' AND table_name = 'PageShare'
  ) THEN
    ALTER TABLE "PageShare"
      ADD CONSTRAINT "PageShare_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "Comment_authorId_idx" ON "Comment" ("authorId");
CREATE INDEX IF NOT EXISTS "PageShare_createdById_idx" ON "PageShare" ("createdById");
