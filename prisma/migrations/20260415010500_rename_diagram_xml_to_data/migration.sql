-- RedefineTables (SQLite) to rename Diagram.xml -> Diagram.data without data loss.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Diagram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Untitled diagram',
    "data" TEXT NOT NULL DEFAULT '',
    "preview" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Diagram_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Copy rows. Existing xml payloads are drawio format and unusable in Excalidraw,
-- so we seed `data` with an empty Excalidraw document in all cases.
INSERT INTO "new_Diagram" ("id", "pageId", "title", "data", "preview", "createdAt", "updatedAt")
SELECT
    "id",
    "pageId",
    "title",
    '{"type":"excalidraw","version":2,"source":"myconfluence","elements":[],"appState":{"viewBackgroundColor":"#ffffff","gridSize":null},"files":{}}',
    "preview",
    "createdAt",
    "updatedAt"
FROM "Diagram";

DROP TABLE "Diagram";
ALTER TABLE "new_Diagram" RENAME TO "Diagram";

CREATE INDEX "Diagram_pageId_idx" ON "Diagram"("pageId");

PRAGMA foreign_keys=ON;
