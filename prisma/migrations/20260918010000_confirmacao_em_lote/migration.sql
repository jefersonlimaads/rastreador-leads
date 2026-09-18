-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "tokenConfirmacao" TEXT;

-- AlterTable
ALTER TABLE "Lead" ALTER COLUMN "telefone" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_tokenConfirmacao_key" ON "Cliente"("tokenConfirmacao");
