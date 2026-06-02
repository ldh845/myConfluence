-- FR-073 (Cycle 25) — 이모지 반응.
-- pageId XOR commentId. Page/Comment 삭제 시 cascade.

CREATE TABLE IF NOT EXISTS "Reaction" (
  "id"          TEXT NOT NULL,
  "emoji"       TEXT NOT NULL,
  "reactorId"   TEXT NOT NULL,
  "reactorName" TEXT,
  "pageId"      TEXT,
  "commentId"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Reaction_pageId_idx" ON "Reaction" ("pageId");
CREATE INDEX IF NOT EXISTS "Reaction_commentId_idx" ON "Reaction" ("commentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Reaction_pageId_fkey' AND table_name = 'Reaction'
  ) THEN
    ALTER TABLE "Reaction"
      ADD CONSTRAINT "Reaction_pageId_fkey"
      FOREIGN KEY ("pageId") REFERENCES "Page"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Reaction_commentId_fkey' AND table_name = 'Reaction'
  ) THEN
    ALTER TABLE "Reaction"
      ADD CONSTRAINT "Reaction_commentId_fkey"
      FOREIGN KEY ("commentId") REFERENCES "Comment"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
