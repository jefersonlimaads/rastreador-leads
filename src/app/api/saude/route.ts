import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { chaveValida } from "@/lib/cripto";

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

/**
 * Por que a chave é inválida, sem revelar a chave: formato, sobras comuns de
 * copiar e colar, e uma impressão digital curta (8 caracteres de um hash) para
 * comparar com a chave certa.
 */
function diagnosticoChave(v: string | undefined) {
  if (!v || chaveValida()) return undefined;
  const digital = (x: string) => createHash("sha256").update(x).digest("hex").slice(0, 8);
  const limpo = v.trim().replace(/^CHAVE_CRIPTOGRAFIA=/, "").replace(/^["']|["']$/g, "");
  return {
    temEspacoOuQuebra: /\s/.test(v),
    temAspas: /["']/.test(v),
    comecaComNome: v.trim().startsWith("CHAVE_CRIPTOGRAFIA"),
    repetida: limpo.length % 2 === 0 && limpo.slice(0, limpo.length / 2) === limpo.slice(limpo.length / 2),
    digitalInteira: digital(v),
    digitalPrimeiros44: digital(limpo.slice(0, 44)),
    digitalUltimos44: digital(limpo.slice(-44)),
  };
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
    CHAVE_CRIPTOGRAFIA:
      estado(process.env.CHAVE_CRIPTOGRAFIA) +
      (process.env.CHAVE_CRIPTOGRAFIA ? (chaveValida() ? ", válida" : ", INVÁLIDA: precisa ter 44 caracteres") : ""),
    diagnosticoChave: diagnosticoChave(process.env.CHAVE_CRIPTOGRAFIA),
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
