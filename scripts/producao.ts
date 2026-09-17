/**
 * Prepara o banco de produção (Supabase) a partir de .env.production.local.
 *
 *   npm run prod:migrar   aplica as migrations usando a conexão direta
 *   npm run prod:admin    cria o primeiro administrador
 *
 * As migrations usam DIRECT_URL, na porta 5432: o pooler do Supabase não aceita
 * os comandos de criação de tabela. A aplicação, em produção, usa o pooler.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { conexaoPg } from "../src/lib/supabase-ca";

const ARQUIVO = path.join(process.cwd(), ".env.production.local");

function carregarProducao(): Record<string, string> {
  if (!fs.existsSync(ARQUIVO)) {
    throw new Error(`Não achei ${ARQUIVO}. Crie o arquivo antes de rodar.`);
  }
  const valores: Record<string, string> = {};
  for (const linha of fs.readFileSync(ARQUIVO, "utf8").split("\n")) {
    const achado = linha.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (achado) valores[achado[1]] = achado[2];
  }
  return valores;
}

function exigir(valores: Record<string, string>, chave: string) {
  const valor = valores[chave];
  if (!valor) {
    throw new Error(`${chave} está vazio em .env.production.local. Preencha e rode de novo.`);
  }
  return valor;
}

function migrar() {
  const valores = carregarProducao();
  const direta = exigir(valores, "DIRECT_URL");

  if (!/:5432\//.test(direta)) {
    console.warn("Aviso: DIRECT_URL não está na porta 5432. Migration pode falhar no pooler.");
  }

  console.log("Aplicando migrations no banco de produção...");
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    // A senha vai só para o processo filho, nunca para a saída do terminal.
    env: { ...process.env, DATABASE_URL: direta },
  });
  console.log("Migrations aplicadas.");
}

async function criarAdmin() {
  const valores = carregarProducao();
  const url = exigir(valores, "DIRECT_URL");
  const email = exigir(valores, "ADMIN_EMAIL").toLowerCase();
  const senha = exigir(valores, "ADMIN_SENHA");

  if (senha.length < 10) {
    throw new Error("ADMIN_SENHA precisa de pelo menos 10 caracteres.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg(conexaoPg(url)),
  });
  const senhaHash = await bcrypt.hash(senha, 10);

  const usuario = await prisma.usuario.upsert({
    where: { email },
    update: { senhaHash, papel: "ADMIN", ativo: true, clienteId: null },
    create: { nome: "Administrador JL Ads", email, senhaHash, papel: "ADMIN", clienteId: null },
  });

  await prisma.$disconnect();
  console.log(`Administrador pronto: ${usuario.email}`);
  console.log("Agora apague ADMIN_EMAIL e ADMIN_SENHA de .env.production.local.");
}

const comando = process.argv[2];
if (comando === "admin") {
  criarAdmin().catch((e) => {
    console.error(String(e.message ?? e));
    process.exit(1);
  });
} else {
  try {
    migrar();
  } catch (e) {
    console.error(String((e as Error).message ?? e));
    process.exit(1);
  }
}
