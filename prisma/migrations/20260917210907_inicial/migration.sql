-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'GESTOR', 'ATENDENTE');

-- CreateEnum
CREATE TYPE "StatusClique" AS ENUM ('PENDENTE', 'CASADO', 'SEM_CONTATO');

-- CreateEnum
CREATE TYPE "Origem" AS ENUM ('MANUAL', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "StatusLead" AS ENUM ('NOVO', 'EM_ATENDIMENTO', 'ORCAMENTO_ENVIADO', 'FECHADO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "Atribuicao" AS ENUM ('EXATA', 'PROVAVEL', 'DESCONHECIDA');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('MENSAGEM', 'MUDANCA_STATUS', 'CONTATO', 'FOLLOW_UP', 'NOTA', 'RETORNO');

-- CreateEnum
CREATE TYPE "TipoEnvioCapi" AS ENUM ('LEAD', 'PURCHASE');

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "contaAnunciosId" TEXT,
    "fuso" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "pixelId" TEXT,
    "capiToken" TEXT,
    "marketingToken" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NumeroWhatsapp" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "rotulo" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NumeroWhatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'ATENDENTE',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clique" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "campaignId" TEXT,
    "adsetId" TEXT,
    "adId" TEXT,
    "fbclid" TEXT,
    "fbp" TEXT,
    "fbc" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "url" TEXT,
    "status" "StatusClique" NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Clique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "cliqueId" TEXT,
    "leadAnteriorId" TEXT,
    "telefone" TEXT NOT NULL,
    "nome" TEXT,
    "origem" "Origem" NOT NULL DEFAULT 'MANUAL',
    "status" "StatusLead" NOT NULL DEFAULT 'NOVO',
    "atribuicao" "Atribuicao" NOT NULL DEFAULT 'DESCONHECIDA',
    "mensagemEm" TIMESTAMP(3) NOT NULL,
    "valorVenda" DECIMAL(12,2),
    "motivoPerda" TEXT,
    "responsavelId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadoEm" TIMESTAMP(3),
    "arquivadoEm" TIMESTAMP(3),

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tipo" "TipoEvento" NOT NULL,
    "descricao" TEXT,
    "usuarioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gasto" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "adsetId" TEXT,
    "campaignId" TEXT,
    "adNome" TEXT,
    "adsetNome" TEXT,
    "campaignNome" TEXT,
    "dia" DATE NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "impressoes" INTEGER NOT NULL DEFAULT 0,
    "cliques" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvioCapi" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tipo" "TipoEnvioCapi" NOT NULL,
    "valor" DECIMAL(12,2),
    "statusResposta" INTEGER,
    "resposta" TEXT,
    "payload" JSONB NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "enviadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvioCapi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NumeroWhatsapp_clienteId_idx" ON "NumeroWhatsapp"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_clienteId_idx" ON "Usuario"("clienteId");

-- CreateIndex
CREATE INDEX "Clique_clienteId_status_criadoEm_idx" ON "Clique"("clienteId", "status", "criadoEm");

-- CreateIndex
CREATE INDEX "Clique_clienteId_adId_idx" ON "Clique"("clienteId", "adId");

-- CreateIndex
CREATE UNIQUE INDEX "Clique_clienteId_codigo_key" ON "Clique"("clienteId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_cliqueId_key" ON "Lead"("cliqueId");

-- CreateIndex
CREATE INDEX "Lead_clienteId_telefone_idx" ON "Lead"("clienteId", "telefone");

-- CreateIndex
CREATE INDEX "Lead_clienteId_status_criadoEm_idx" ON "Lead"("clienteId", "status", "criadoEm");

-- CreateIndex
CREATE INDEX "Lead_clienteId_criadoEm_idx" ON "Lead"("clienteId", "criadoEm");

-- CreateIndex
CREATE INDEX "Evento_leadId_criadoEm_idx" ON "Evento"("leadId", "criadoEm");

-- CreateIndex
CREATE INDEX "Evento_clienteId_criadoEm_idx" ON "Evento"("clienteId", "criadoEm");

-- CreateIndex
CREATE INDEX "Gasto_clienteId_dia_idx" ON "Gasto"("clienteId", "dia");

-- CreateIndex
CREATE UNIQUE INDEX "Gasto_clienteId_adId_dia_key" ON "Gasto"("clienteId", "adId", "dia");

-- CreateIndex
CREATE UNIQUE INDEX "EnvioCapi_eventId_key" ON "EnvioCapi"("eventId");

-- CreateIndex
CREATE INDEX "EnvioCapi_clienteId_criadoEm_idx" ON "EnvioCapi"("clienteId", "criadoEm");

-- CreateIndex
CREATE INDEX "EnvioCapi_leadId_idx" ON "EnvioCapi"("leadId");

-- AddForeignKey
ALTER TABLE "NumeroWhatsapp" ADD CONSTRAINT "NumeroWhatsapp_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clique" ADD CONSTRAINT "Clique_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_cliqueId_fkey" FOREIGN KEY ("cliqueId") REFERENCES "Clique"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_leadAnteriorId_fkey" FOREIGN KEY ("leadAnteriorId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvioCapi" ADD CONSTRAINT "EnvioCapi_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvioCapi" ADD CONSTRAINT "EnvioCapi_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
