-- CreateEnum
CREATE TYPE "TipoFunil" AS ENUM ('SIMPLES', 'COMPLETO');

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "funil" "TipoFunil" NOT NULL DEFAULT 'COMPLETO';
