-- CreateTable
CREATE TABLE "ParametroDiagnostico" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "clienteId" TEXT,
    "nicho" TEXT,
    "chave" TEXT NOT NULL,
    "ruim" DOUBLE PRECISION NOT NULL,
    "bom" DOUBLE PRECISION NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParametroDiagnostico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParametroDiagnostico_agenciaId_chave_idx" ON "ParametroDiagnostico"("agenciaId", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "ParametroDiagnostico_agenciaId_clienteId_nicho_chave_key" ON "ParametroDiagnostico"("agenciaId", "clienteId", "nicho", "chave");

-- AddForeignKey
ALTER TABLE "ParametroDiagnostico" ADD CONSTRAINT "ParametroDiagnostico_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "Agencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParametroDiagnostico" ADD CONSTRAINT "ParametroDiagnostico_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
