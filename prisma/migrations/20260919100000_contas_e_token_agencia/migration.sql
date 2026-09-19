-- AlterTable
ALTER TABLE "Agencia" ADD COLUMN "metaToken" TEXT;

-- CreateTable
CREATE TABLE "ContaAnuncios" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "nome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaAnuncios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContaAnuncios_clienteId_contaId_key" ON "ContaAnuncios"("clienteId", "contaId");

-- CreateIndex
CREATE INDEX "ContaAnuncios_contaId_idx" ON "ContaAnuncios"("contaId");

-- AddForeignKey
ALTER TABLE "ContaAnuncios" ADD CONSTRAINT "ContaAnuncios_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Dados: a conta única de cada cliente vira a primeira da lista.
INSERT INTO "ContaAnuncios" ("id", "clienteId", "contaId")
SELECT 'ca' || md5("id"), "id",
       CASE WHEN "contaAnunciosId" LIKE 'act\_%' THEN "contaAnunciosId" ELSE 'act_' || "contaAnunciosId" END
FROM "Cliente"
WHERE "contaAnunciosId" IS NOT NULL AND btrim("contaAnunciosId") <> '';

-- Dados: o token que já estava num cliente passa a ser o da agência (continua cifrado).
UPDATE "Agencia" a
SET "metaToken" = (
  SELECT c."marketingToken" FROM "Cliente" c
  WHERE c."agenciaId" = a."id" AND c."marketingToken" IS NOT NULL
  ORDER BY c."criadoEm" DESC LIMIT 1
)
WHERE a."metaToken" IS NULL;
