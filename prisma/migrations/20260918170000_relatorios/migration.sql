-- CreateTable
CREATE TABLE "Relatorio" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "de" DATE NOT NULL,
    "ate" DATE NOT NULL,
    "comentario" TEXT,
    "criadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visualizadoEm" TIMESTAMP(3),
    "visualizacoes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Relatorio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Relatorio_token_key" ON "Relatorio"("token");

-- CreateIndex
CREATE INDEX "Relatorio_clienteId_criadoEm_idx" ON "Relatorio"("clienteId", "criadoEm");

-- AddForeignKey
ALTER TABLE "Relatorio" ADD CONSTRAINT "Relatorio_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
