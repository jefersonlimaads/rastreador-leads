import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Diagnóstico de ambiente. Responde só com sim/não e o tipo do erro: nunca
 * mostra valor de variável, senha ou string de conexão. Serve para descobrir,
 * de fora, se o painel está sem variável ou sem banco.
 */
export async function GET() {
  const url = process.env.DATABASE_URL;

  const ambiente = {
    DATABASE_URL: Boolean(url),
    AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
    CRON_SECRET: Boolean(process.env.CRON_SECRET),
    APP_URL: Boolean(process.env.APP_URL),
    portaDoBanco: url ? (new URL(url).port || "padrão") : null,
    hostDoBanco: url ? new URL(url).hostname.replace(/^[^.]+/, "***") : null,
  };

  let banco: { ok: boolean; erro?: string; usuarios?: number } = { ok: false };
  try {
    banco = { ok: true, usuarios: await prisma.usuario.count() };
  } catch (erro) {
    banco = { ok: false, erro: (erro as Error).message.split("\n")[0].slice(0, 200) };
  }

  return NextResponse.json({ ambiente, banco }, { status: banco.ok ? 200 : 503 });
}
