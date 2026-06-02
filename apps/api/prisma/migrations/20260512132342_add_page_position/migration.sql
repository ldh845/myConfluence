-- FR-021 (Cycle 19a) — 사이드바 트리 드래그앤드롭용 position 컬럼.
-- 같은 (spaceId, parentId) 그룹 안에서 0,1,2,... 순서. reorder는 그룹 전체를
-- 일괄 재부여.

ALTER TABLE "Page"
  ADD COLUMN IF NOT EXISTS "position" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Page_parent_position_idx"
  ON "Page" ("parentId", "position");

-- 기존 행에 position 부여: (spaceId, parentId) 그룹별 createdAt asc 순서.
-- NULL parentId는 spaceId별로 분리된 root 그룹.
WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "spaceId", "parentId"
      ORDER BY "createdAt"
    ) - 1 AS rn
  FROM "Page"
)
UPDATE "Page"
SET "position" = ordered.rn
FROM ordered
WHERE "Page".id = ordered.id;
