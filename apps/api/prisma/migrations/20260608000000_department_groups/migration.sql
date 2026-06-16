-- Cycle L10 (feature/ldh) — 부서 자동 권한.
--   GroupSource 에 DEPARTMENT 추가 + 부서명→그룹 매핑 테이블.
--   (PG16: ALTER TYPE ... ADD VALUE 는 트랜잭션 내 실행 가능 — 본 마이그레이션은
--    새 값을 데이터로 사용하지 않으므로 안전.)

-- AlterEnum
ALTER TYPE "GroupSource" ADD VALUE 'DEPARTMENT';

-- CreateTable
CREATE TABLE "department_group_mappings" (
    "department" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "department_group_mappings_pkey" PRIMARY KEY ("department")
);

-- CreateIndex
CREATE INDEX "department_group_mappings_groupId_idx" ON "department_group_mappings"("groupId");

-- AddForeignKey
ALTER TABLE "department_group_mappings" ADD CONSTRAINT "department_group_mappings_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
