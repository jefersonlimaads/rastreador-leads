/**
 * Configuração do Prisma em CommonJS, de propósito.
 *
 * Em prisma.config.ts, o carregamento depende do Node conseguir ler TypeScript
 * direto, o que varia com a versão. Na Vercel isso quebrava o build com
 * "Failed to load config file". Em .cjs funciona em qualquer versão.
 */
require("dotenv/config");
const path = require("node:path");

module.exports = {
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
};
