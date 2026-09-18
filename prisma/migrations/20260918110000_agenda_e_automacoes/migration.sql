-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "reuniaoEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tarefa" ADD COLUMN     "automatica" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "chave" TEXT,
ADD COLUMN     "duracaoMin" INTEGER,
ADD COLUMN     "inicio" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Tarefa_status_inicio_idx" ON "Tarefa"("status", "inicio");
