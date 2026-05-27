-- Cycle 59 — 알림 (Notification). 사용자가 받는 모든 알림.
--   같은 (recipient, actor, page, type) 조합은 한 번만 (@@unique) — dedupe.
--   recipient FK Cascade(본인 데이터), actor SetNull(원 사용자 삭제 후에도 알림 보존),
--   page SetNull(페이지 삭제 후에도 알림 보존).
--   type: 'mention' (현재). 향후 'comment.reply', 'page.commented' 등 확장.

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "pageId" TEXT,
    "payload" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- dedupe: 같은 조합 한 번만
CREATE UNIQUE INDEX "Notification_dedupe_key"
    ON "Notification"("recipientId", "actorId", "pageId", "type");

-- 미읽 조회 가속
CREATE INDEX "Notification_recipientId_readAt_idx"
    ON "Notification"("recipientId", "readAt");
-- 최근순 조회 가속
CREATE INDEX "Notification_recipientId_createdAt_idx"
    ON "Notification"("recipientId", "createdAt");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey"
    FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_pageId_fkey"
    FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;
