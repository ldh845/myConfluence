-- Cycle L7-2 (feature/ldh) — 페이지 단위 제한에 그룹 멤버 추가.
--   개인 PageRestriction 무변경. 판정 시 개인∪그룹 max 결합(BE).

-- CreateTable
CREATE TABLE "page_restriction_groups" (
    "pageId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "role" "PageRestrictionRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "page_restriction_groups_pkey" PRIMARY KEY ("pageId","groupId")
);

-- CreateIndex
CREATE INDEX "page_restriction_groups_pageId_idx" ON "page_restriction_groups"("pageId");

-- CreateIndex
CREATE INDEX "page_restriction_groups_groupId_idx" ON "page_restriction_groups"("groupId");

-- AddForeignKey
ALTER TABLE "page_restriction_groups" ADD CONSTRAINT "page_restriction_groups_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_restriction_groups" ADD CONSTRAINT "page_restriction_groups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
