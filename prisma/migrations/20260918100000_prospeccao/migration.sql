-- Etapas antes da proposta, e o prospect perdido.
ALTER TYPE "CicloCliente" ADD VALUE 'ABORDADO' AFTER 'PROSPECCAO';
ALTER TYPE "CicloCliente" ADD VALUE 'RESPONDEU' AFTER 'ABORDADO';
ALTER TYPE "CicloCliente" ADD VALUE 'REUNIAO_MARCADA' AFTER 'RESPONDEU';
ALTER TYPE "CicloCliente" ADD VALUE 'PERDIDO';

CREATE TYPE "TipoInteracao" AS ENUM ('MENSAGEM', 'LIGACAO', 'REUNIAO', 'EMAIL', 'NOTA');

ALTER TABLE "Cliente" ADD COLUMN "nicho" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "origem" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "instagram" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "site" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "proximoContato" DATE;
ALTER TABLE "Cliente" ADD COLUMN "motivoPerda" TEXT;

CREATE TABLE "Interacao" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tipo" "TipoInteracao" NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Interacao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Interacao_clienteId_criadoEm_idx" ON "Interacao"("clienteId", "criadoEm");

ALTER TABLE "Interacao" ADD CONSTRAINT "Interacao_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
