-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "entity" TEXT;

-- AlterTable
ALTER TABLE "DocumentCategory" ADD COLUMN     "code" TEXT,
ADD COLUMN     "referenceTemplate" TEXT;
