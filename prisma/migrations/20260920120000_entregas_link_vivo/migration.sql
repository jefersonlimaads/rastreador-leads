-- AlterTable
ALTER TABLE "Relatorio" ADD COLUMN "diasMoveis" INTEGER;

-- CreateTable
CREATE TABLE "Entrega" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "competencia" DATE NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entrega_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Entrega_clienteId_competencia_idx" ON "Entrega"("clienteId", "competencia");

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
