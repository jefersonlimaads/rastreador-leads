-- AlterEnum
ALTER TYPE "StatusLead" ADD VALUE 'QUALIFICADO';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "motivoPerdaCategoria" TEXT;
