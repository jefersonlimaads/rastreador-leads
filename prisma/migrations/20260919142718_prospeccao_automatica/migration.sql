-- CreateTable
CREATE TABLE "BuscaProspeccao" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "nicho" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "notaMinima" INTEGER NOT NULL DEFAULT 50,
    "status" TEXT NOT NULL DEFAULT 'RODANDO',
    "encontrados" INTEGER NOT NULL DEFAULT 0,
    "analisados" INTEGER NOT NULL DEFAULT 0,
    "adicionados" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "concluidaEm" TIMESTAMP(3),

    CONSTRAINT "BuscaProspeccao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Diagnostico" (
    "id" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "buscaId" TEXT,
    "clienteId" TEXT,
    "placeId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT,
    "telefone" TEXT,
    "site" TEXT,
    "endereco" TEXT,
    "mapsUrl" TEXT,
    "notaGoogle" DOUBLE PRECISION,
    "avaliacoes" INTEGER,
    "instagram" TEXT,
    "facebook" TEXT,
    "sinais" JSONB,
    "pontuacao" INTEGER,
    "resumo" TEXT,
    "gaps" JSONB,
    "briefing" TEXT,
    "mensagem" TEXT,
    "analisadoPorIa" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "erro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analisadoEm" TIMESTAMP(3),

    CONSTRAINT "Diagnostico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuscaProspeccao_agenciaId_criadoEm_idx" ON "BuscaProspeccao"("agenciaId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Diagnostico_clienteId_key" ON "Diagnostico"("clienteId");

-- CreateIndex
CREATE INDEX "Diagnostico_buscaId_status_idx" ON "Diagnostico"("buscaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Diagnostico_agenciaId_placeId_key" ON "Diagnostico"("agenciaId", "placeId");

-- AddForeignKey
ALTER TABLE "BuscaProspeccao" ADD CONSTRAINT "BuscaProspeccao_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "Agencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnostico" ADD CONSTRAINT "Diagnostico_buscaId_fkey" FOREIGN KEY ("buscaId") REFERENCES "BuscaProspeccao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnostico" ADD CONSTRAINT "Diagnostico_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
