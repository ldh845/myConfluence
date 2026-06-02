-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "status" "PageStatus",
ADD COLUMN     "statusAt" TIMESTAMP(3),
ADD COLUMN     "statusById" TEXT;

-- CreateIndex
CREATE INDEX "Page_statusById_idx" ON "Page"("statusById");

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_statusById_fkey" FOREIGN KEY ("statusById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
