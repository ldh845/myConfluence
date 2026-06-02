-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "labels" TEXT[] DEFAULT ARRAY[]::TEXT[];
