-- AlterTable
ALTER TABLE "Agencia" ADD COLUMN "chaveImportacao" TEXT,
ADD COLUMN "chaveImportacaoFim" TEXT,
ADD COLUMN "chaveImportacaoEm" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Agencia_chaveImportacao_key" ON "Agencia"("chaveImportacao");
