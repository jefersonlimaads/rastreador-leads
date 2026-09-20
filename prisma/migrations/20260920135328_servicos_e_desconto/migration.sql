-- AlterTable
ALTER TABLE "Proposta" ADD COLUMN     "feeCheio" DECIMAL(12,2),
ADD COLUMN     "meses" INTEGER,
ADD COLUMN     "setupCheio" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "ServicoProposta" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "detalhe" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServicoProposta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServicoProposta_agenciaId_ordem_idx" ON "ServicoProposta"("agenciaId", "ordem");

-- AddForeignKey
ALTER TABLE "ServicoProposta" ADD CONSTRAINT "ServicoProposta_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "Agencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
