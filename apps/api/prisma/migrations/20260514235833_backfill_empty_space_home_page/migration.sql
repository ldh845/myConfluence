-- Cycle 33 (follow-up) — 홈 페이지가 없는 기존 공간에 "Main Page" 자동 생성.
-- Cycle 33 백필은 페이지가 이미 있는 공간만 대상이었어서, 빈 공간들은
-- homePageId가 NULL로 남아 진입 시 "만들기"를 눌러야 했다. 이를 보정.

-- 1) homePageId가 NULL인 모든 공간에 "Main Page" 페이지 생성.
INSERT INTO "Page" (id, title, content, "spaceId", "parentId", position, "createdAt", "updatedAt")
SELECT
  'c' || replace(gen_random_uuid()::text, '-', ''),
  'Main Page',
  '# ' || s.name || E'\n\n이 공간의 홈 페이지입니다. 자유롭게 편집하세요.',
  s.id,
  NULL,
  0,
  NOW(),
  NOW()
FROM "Space" s
WHERE s."homePageId" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Page" p
    WHERE p."spaceId" = s.id AND p."deletedAt" IS NULL
  );

-- 2) 방금 만든(또는 기존) 첫 루트 페이지를 homePageId로 지정.
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
