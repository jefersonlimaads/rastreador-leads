-- Camada de agência. Tudo que existia nasce na jl.ads.
CREATE TABLE "Agencia" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Agencia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Agencia_slug_key" ON "Agencia"("slug");

INSERT INTO "Agencia" ("id", "nome", "slug") VALUES ('agencia-jlads', 'jl.ads', 'jlads');

-- O default cobre a janela de deploy: o código antigo segue criando registros
-- sem informar a agência até o novo entrar no ar.
ALTER TABLE "Cliente" ADD COLUMN "agenciaId" TEXT NOT NULL DEFAULT 'agencia-jlads';
ALTER TABLE "Usuario" ADD COLUMN "agenciaId" TEXT NOT NULL DEFAULT 'agencia-jlads';
ALTER TABLE "Usuario" ADD COLUMN "plataforma" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tarefa" ADD COLUMN "agenciaId" TEXT NOT NULL DEFAULT 'agencia-jlads';

-- Quem administrava a jl.ads antes da camada é o dono da plataforma.
UPDATE "Usuario" SET "plataforma" = true WHERE "papel" = 'ADMIN';

ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_agenciaId_fkey"
  FOREIGN KEY ("agenciaId") REFERENCES "Agencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_agenciaId_fkey"
  FOREIGN KEY ("agenciaId") REFERENCES "Agencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_agenciaId_fkey"
  FOREIGN KEY ("agenciaId") REFERENCES "Agencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Cliente_agenciaId_ciclo_idx" ON "Cliente"("agenciaId", "ciclo");
DROP INDEX IF EXISTS "Tarefa_status_prazo_idx";
DROP INDEX IF EXISTS "Tarefa_status_inicio_idx";
CREATE INDEX "Tarefa_agenciaId_status_prazo_idx" ON "Tarefa"("agenciaId", "status", "prazo");
CREATE INDEX "Tarefa_agenciaId_status_inicio_idx" ON "Tarefa"("agenciaId", "status", "inicio");
