-- CreateTable
CREATE TABLE "AcessoCliente" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcessoCliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcessoCliente_usuarioId_idx" ON "AcessoCliente"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "AcessoCliente_usuarioId_clienteId_key" ON "AcessoCliente"("usuarioId", "clienteId");

-- AddForeignKey
ALTER TABLE "AcessoCliente" ADD CONSTRAINT "AcessoCliente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcessoCliente" ADD CONSTRAINT "AcessoCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
