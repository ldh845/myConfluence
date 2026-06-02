-- Cycle 32 — Space.type (SITE/PERSONAL) + ownerId.
-- 기존 스페이스는 DEFAULT 'SITE' 유지 — 백필 불필요.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SpaceType') THEN
    CREATE TYPE "SpaceType" AS ENUM ('SITE', 'PERSONAL');
  END IF;
END$$;

ALTER TABLE "Space"
  ADD COLUMN IF NOT EXISTS "type" "SpaceType" NOT NULL DEFAULT 'SITE';
ALTER TABLE "Space" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Space_ownerId_fkey' AND table_name = 'Space'
  ) THEN
    ALTER TABLE "Space"
      ADD CONSTRAINT "Space_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "Space_ownerId_idx" ON "Space" ("ownerId");
