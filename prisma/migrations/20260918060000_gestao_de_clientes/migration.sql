-- CreateEnum
CREATE TYPE "CicloCliente" AS ENUM ('PROSPECCAO', 'PROPOSTA_ENVIADA', 'NEGOCIANDO', 'ATIVO', 'PAUSADO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "StatusFatura" AS ENUM ('ABERTA', 'PAGA', 'CANCELADA');

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "ciclo" "CicloCliente" NOT NULL DEFAULT 'ATIVO',
ADD COLUMN     "contatoEmail" TEXT,
ADD COLUMN     "contatoNome" TEXT,
ADD COLUMN     "contatoTelefone" TEXT,
ADD COLUMN     "diaVencimento" INTEGER,
ADD COLUMN     "documento" TEXT,
ADD COLUMN     "feeMensal" DECIMAL(12,2),
ADD COLUMN     "inicioContrato" TIMESTAMP(3),
ADD COLUMN     "linkPagamento" TEXT,
ADD COLUMN     "observacoes" TEXT;

-- CreateTable
CREATE TABLE "Fatura" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "competencia" DATE NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "vencimento" DATE NOT NULL,
    "status" "StatusFatura" NOT NULL DEFAULT 'ABERTA',
    "pagoEm" TIMESTAMP(3),
    "linkPagamento" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fatura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Fatura_clienteId_vencimento_idx" ON "Fatura"("clienteId", "vencimento");

-- CreateIndex
CREATE INDEX "Fatura_status_vencimento_idx" ON "Fatura"("status", "vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "Fatura_clienteId_competencia_key" ON "Fatura"("clienteId", "competencia");

-- AddForeignKey
ALTER TABLE "Fatura" ADD CONSTRAINT "Fatura_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
