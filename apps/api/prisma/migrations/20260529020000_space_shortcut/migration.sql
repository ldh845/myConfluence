-- CreateEnum
CREATE TYPE "SpaceShortcutType" AS ENUM ('INTERNAL_PAGE', 'EXTERNAL_URL');

-- CreateTable
CREATE TABLE "SpaceShortcut" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "type" "SpaceShortcutType" NOT NULL,
    "label" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpaceShortcut_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpaceShortcut_spaceId_idx" ON "SpaceShortcut"("spaceId");

-- AddForeignKey
ALTER TABLE "SpaceShortcut" ADD CONSTRAINT "SpaceShortcut_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;
