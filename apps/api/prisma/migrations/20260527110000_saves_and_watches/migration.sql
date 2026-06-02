-- Cycle 53 — '나중을 위해 저장' (SavedPage) + '지켜보기' (WatchList).
-- 둘 다 (userId, pageId) 조합당 한 행. 토글은 서버에서 idempotent 처리.
-- 페이지·사용자 삭제 시 함께 정리(Cascade — 개인 데이터).

-- (1) SavedPage
CREATE TABLE "SavedPage" (
    "userId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedPage_pkey" PRIMARY KEY ("userId", "pageId")
);
CREATE INDEX "SavedPage_userId_idx" ON "SavedPage"("userId");
CREATE INDEX "SavedPage_pageId_idx" ON "SavedPage"("pageId");
ALTER TABLE "SavedPage" ADD CONSTRAINT "SavedPage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedPage" ADD CONSTRAINT "SavedPage_pageId_fkey"
    FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- (2) WatchList — 구조 동일. 의미만 다름(SavedPage = 개인 책갈피,
--      WatchList = 변경 알림 수신자). 향후 알림 정책 진화 시 watch 만 확장될
--      수 있어 둘을 합치지 않는다.
CREATE TABLE "WatchList" (
    "userId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchList_pkey" PRIMARY KEY ("userId", "pageId")
);
CREATE INDEX "WatchList_userId_idx" ON "WatchList"("userId");
CREATE INDEX "WatchList_pageId_idx" ON "WatchList"("pageId");
ALTER TABLE "WatchList" ADD CONSTRAINT "WatchList_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchList" ADD CONSTRAINT "WatchList_pageId_fkey"
    FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
