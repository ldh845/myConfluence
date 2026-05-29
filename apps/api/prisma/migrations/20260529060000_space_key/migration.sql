-- AlterTable
ALTER TABLE "Space" ADD COLUMN     "key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Space_key_key" ON "Space"("key");
