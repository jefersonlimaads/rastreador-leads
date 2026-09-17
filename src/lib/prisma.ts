import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { conexaoPg } from "./supabase-ca";

// Em desenvolvimento o Next recarrega os módulos a cada alteração. Sem o cache
// global, cada recarga abriria um pool novo de conexões e o Postgres recusaria.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function criarCliente() {
  const adapter = new PrismaPg(conexaoPg(process.env.DATABASE_URL));
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? criarCliente();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
