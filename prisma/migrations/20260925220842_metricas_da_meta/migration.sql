-- AlterTable
ALTER TABLE "Gasto" ADD COLUMN     "alcanceDia" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cliquesSaida" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "creativeId" TEXT,
ADD COLUMN     "frequencia" DECIMAL(6,2),
ADD COLUMN     "visualizacoesPagina" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Gasto_clienteId_creativeId_idx" ON "Gasto"("clienteId", "creativeId");
