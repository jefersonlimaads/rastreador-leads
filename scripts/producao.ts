/**
 * Prepara o banco de produção (Supabase) a partir de .env.production.local.
 *
 *   npm run prod:migrar   aplica as migrations usando a conexão direta
 *   npm run prod:admin    cria o primeiro administrador
 *   npm run prod:senha <email>   gera uma senha temporária para quem esqueceu
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
    create: {
      agenciaId: "agencia-jlads",
      nome: "Administrador JL Ads",
      email,
      senhaHash,
      papel: "ADMIN",
      plataforma: true,
      clienteId: null,
    },
  });

  await prisma.$disconnect();
  console.log(`Administrador pronto: ${usuario.email}`);
  console.log("Agora apague ADMIN_EMAIL e ADMIN_SENHA de .env.production.local.");
}

/**
 * Redefine a senha de um usuário para uma senha temporária gerada aqui.
 * Quem recebe deve trocar em Ajustes no primeiro acesso: esta senha passa por
 * terminal e histórico, então não serve como senha definitiva.
 */
async function redefinirSenha() {
  const valores = carregarProducao();
  const url = exigir(valores, "DIRECT_URL");
  const email = (process.argv[3] ?? "").toLowerCase();
  if (!email) throw new Error("Informe o e-mail: npm run prod:senha -- alguem@exemplo.com");

  const prisma = new PrismaClient({ adapter: new PrismaPg(conexaoPg(url)) });
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) {
    await prisma.$disconnect();
    throw new Error(`Não existe usuário com o e-mail ${email}.`);
  }

  // Palavras fáceis de digitar no celular, que é onde o painel é usado.
  const palavras = ["lead", "anuncio", "painel", "conversa", "funil", "clique", "venda", "cliente"];
  const sortear = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const senha = `${palavras[sortear(palavras.length)]}-${palavras[sortear(palavras.length)]}-${100 + sortear(900)}`;

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { senhaHash: await bcrypt.hash(senha, 10) },
  });
  await prisma.$disconnect();

  console.log(`Senha temporária de ${email}: ${senha}`);
  console.log("Entre no painel e troque em Ajustes > Minha senha.");
}

const comando = process.argv[2];
if (comando === "senha") {
  redefinirSenha().catch((e) => {
    console.error(String(e.message ?? e));
    process.exit(1);
  });
} else if (comando === "admin") {
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
