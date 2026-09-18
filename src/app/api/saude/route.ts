import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Roda em São Paulo, junto do banco.
export const preferredRegion = "gru1";

/**
 * Diagnóstico de ambiente. Responde só com o estado de cada variável e o tipo do
 * erro do banco: nunca mostra valor, senha ou string de conexão.
 *
 * A diferença entre "ausente" e "vazia" importa: ausente é variável que não
 * chegou ao deploy; vazia é variável que chegou sem conteúdo.
 */
function estado(valor: string | undefined) {
  if (valor === undefined) return "ausente";
  if (valor.trim() === "") return "vazia";
  return `ok (${valor.length} caracteres)`;
}

export async function GET() {
  const url = process.env.DATABASE_URL;

  let destino: string | null = null;
  if (url) {
    try {
      const u = new URL(url);
      destino = `${u.hostname.replace(/^[^.]+/, "***")}:${u.port || "padrão"}`;
    } catch {
      destino = "string de conexão em formato inválido";
    }
  }

  const ambiente = {
    DATABASE_URL: estado(url),
    AUTH_SECRET: estado(process.env.AUTH_SECRET),
    CRON_SECRET: estado(process.env.CRON_SECRET),
    APP_URL: estado(process.env.APP_URL),
    CHAVE_CRIPTOGRAFIA: estado(process.env.CHAVE_CRIPTOGRAFIA),
    destino,
    vercelEnv: process.env.VERCEL_ENV ?? "fora da Vercel",
    // Quantas variáveis o processo enxerga no total, para saber se o problema
    // é só com as nossas ou com a injeção inteira.
    totalDeVariaveis: Object.keys(process.env).length,
  };

  let banco: { ok: boolean; erro?: string; usuarios?: number } = { ok: false };
  try {
    banco = { ok: true, usuarios: await prisma.usuario.count() };
  } catch (erro) {
    banco = { ok: false, erro: (erro as Error).message.split("\n")[0].slice(0, 200) };
  }

  return NextResponse.json({ ambiente, banco }, { status: banco.ok ? 200 : 503 });
}
