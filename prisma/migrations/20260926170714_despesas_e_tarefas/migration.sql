-- AlterTable
ALTER TABLE "Tarefa" ADD COLUMN     "prioridade" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "recorrencia" TEXT;

-- CreateTable
CREATE TABLE "Despesa" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "clienteId" TEXT,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT,
    "valor" DECIMAL(12,2) NOT NULL,
    "competencia" DATE NOT NULL,
    "vencimento" DATE,
    "pagoEm" DATE,
    "recorrente" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Despesa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Despesa_agenciaId_competencia_idx" ON "Despesa"("agenciaId", "competencia");

-- CreateIndex
CREATE INDEX "Despesa_clienteId_competencia_idx" ON "Despesa"("clienteId", "competencia");

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "Agencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
