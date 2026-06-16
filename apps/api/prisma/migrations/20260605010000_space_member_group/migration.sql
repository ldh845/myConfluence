-- Cycle L7 (feature/ldh) — 스페이스 ↔ 그룹 권한 부여. 개인 SpaceMember 와 max 결합.

-- CreateTable
CREATE TABLE "space_member_groups" (
    "spaceId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "role" "SpaceRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "space_member_groups_pkey" PRIMARY KEY ("spaceId","groupId")
);

-- CreateIndex
CREATE INDEX "space_member_groups_groupId_idx" ON "space_member_groups"("groupId");

-- AddForeignKey
ALTER TABLE "space_member_groups" ADD CONSTRAINT "space_member_groups_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_member_groups" ADD CONSTRAINT "space_member_groups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
