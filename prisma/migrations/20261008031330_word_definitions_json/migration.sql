-- AlterTable
ALTER TABLE "WordEntry" DROP COLUMN "meaning",
ADD COLUMN     "definitions" JSONB;

