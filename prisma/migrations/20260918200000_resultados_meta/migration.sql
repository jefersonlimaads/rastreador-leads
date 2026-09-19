-- AlterTable
ALTER TABLE "Gasto" ADD COLUMN "objetivo" TEXT,
ADD COLUMN "otimizacao" TEXT,
ADD COLUMN "cliquesLink" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "acoes" JSONB,
ADD COLUMN "valoresAcoes" JSONB;
