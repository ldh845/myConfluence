-- Cycle 33 — Space.homePageId. 공간의 명시적 홈(메인) 페이지.
-- 홈 페이지 삭제 시 SetNull.

ALTER TABLE "Space" ADD COLUMN IF NOT EXISTS "homePageId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Space_homePageId_key"
  ON "Space" ("homePageId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Space_homePageId_fkey' AND table_name = 'Space'
  ) THEN
    ALTER TABLE "Space"
      ADD CONSTRAINT "Space_homePageId_fkey"
      FOREIGN KEY ("homePageId") REFERENCES "Page"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- 기존 공간 백필 — 각 공간의 첫 루트 페이지(parentId NULL, 미삭제, position/createdAt 최상단).
-- 페이지가 없는 공간은 homePageId NULL로 남는다.
WITH first_root AS (
  SELECT DISTINCT ON ("spaceId") "spaceId", id
  FROM "Page"
  WHERE "parentId" IS NULL AND "deletedAt" IS NULL
  ORDER BY "spaceId", "position" ASC, "createdAt" ASC
)
UPDATE "Space"
SET "homePageId" = first_root.id
FROM first_root
WHERE "Space".id = first_root."spaceId"
  AND "Space"."homePageId" IS NULL;
