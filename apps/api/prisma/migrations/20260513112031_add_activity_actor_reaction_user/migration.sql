-- FR-001 / Cycle 27e — ActivityLog.actorId (SetNull) + Reaction.userId (Cascade).
-- 익명 reactorId/reactorName 컬럼은 폐지. 모든 기존 row는 'legacy' 시스템 유저로 백필.

-- 안전망: legacy user 보장 (Cycle 27c에서 INSERT됨, idempotent).
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

-- ActivityLog.actorId: nullable, SetNull on user delete.
ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "actorId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ActivityLog_actorId_fkey' AND table_name = 'ActivityLog'
  ) THEN
    ALTER TABLE "ActivityLog"
      ADD CONSTRAINT "ActivityLog_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "ActivityLog_actorId_idx" ON "ActivityLog" ("actorId");

-- Reaction.userId: NOT NULL, Cascade. 익명 컬럼 DROP.
ALTER TABLE "Reaction" ADD COLUMN IF NOT EXISTS "userId" TEXT;
UPDATE "Reaction" SET "userId" = 'legacy' WHERE "userId" IS NULL;
ALTER TABLE "Reaction" ALTER COLUMN "userId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Reaction_userId_fkey' AND table_name = 'Reaction'
  ) THEN
    ALTER TABLE "Reaction"
      ADD CONSTRAINT "Reaction_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "Reaction_userId_idx" ON "Reaction" ("userId");

-- 동일 (target, emoji, user)는 한 번만. service 가드 대신 DB 제약.
-- 백필이 끝난 뒤 적용 — legacy row 중 동일 그룹 중복은 keep first, delete rest.
DELETE FROM "Reaction" r1
USING "Reaction" r2
WHERE r1."id" > r2."id"
  AND r1."emoji" = r2."emoji"
  AND r1."userId" = r2."userId"
  AND COALESCE(r1."pageId", '') = COALESCE(r2."pageId", '')
  AND COALESCE(r1."commentId", '') = COALESCE(r2."commentId", '');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Reaction_target_emoji_user_key'
  ) THEN
    ALTER TABLE "Reaction"
      ADD CONSTRAINT "Reaction_target_emoji_user_key"
      UNIQUE ("pageId", "commentId", "emoji", "userId");
  END IF;
END$$;

ALTER TABLE "Reaction" DROP COLUMN IF EXISTS "reactorId";
ALTER TABLE "Reaction" DROP COLUMN IF EXISTS "reactorName";
