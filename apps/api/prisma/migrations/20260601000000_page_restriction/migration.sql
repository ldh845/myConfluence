-- CreateEnum
CREATE TYPE "PageRestrictionMode" AS ENUM ('NONE', 'EDIT', 'VIEW_EDIT');

-- CreateEnum
CREATE TYPE "PageRestrictionRole" AS ENUM ('EDIT', 'VIEW');

-- AlterTable
ALTER TABLE "Page" ADD COLUMN "restrictionMode" "PageRestrictionMode" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "PageRestriction" (
    "pageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PageRestrictionRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PageRestriction_pkey" PRIMARY KEY ("pageId","userId")
);

-- CreateIndex
CREATE INDEX "PageRestriction_pageId_idx" ON "PageRestriction"("pageId");

-- CreateIndex
CREATE INDEX "PageRestriction_userId_idx" ON "PageRestriction"("userId");

-- AddForeignKey
ALTER TABLE "PageRestriction" ADD CONSTRAINT "PageRestriction_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageRestriction" ADD CONSTRAINT "PageRestriction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
