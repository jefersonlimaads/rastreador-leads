-- CreateEnum
CREATE TYPE "StatusProposta" AS ENUM ('RASCUNHO', 'ENVIADA', 'ACEITA', 'RECUSADA');

-- CreateTable
CREATE TABLE "Proposta" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "StatusProposta" NOT NULL DEFAULT 'RASCUNHO',
    "titulo" TEXT NOT NULL,
    "apresentacao" TEXT,
    "escopo" JSONB NOT NULL,
    "feeMensal" DECIMAL(12,2),
    "setup" DECIMAL(12,2),
    "condicoes" TEXT,
    "validade" DATE NOT NULL,
    "enviadaEm" TIMESTAMP(3),
    "visualizadaEm" TIMESTAMP(3),
    "visualizacoes" INTEGER NOT NULL DEFAULT 0,
    "respondidaEm" TIMESTAMP(3),
    "aceitaPor" TEXT,
    "motivoRecusa" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Proposta_token_key" ON "Proposta"("token");

-- CreateIndex
CREATE INDEX "Proposta_clienteId_criadoEm_idx" ON "Proposta"("clienteId", "criadoEm");

-- CreateIndex
CREATE INDEX "Proposta_status_idx" ON "Proposta"("status");

-- AddForeignKey
ALTER TABLE "Proposta" ADD CONSTRAINT "Proposta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
