import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sincronizarGastos } from "@/lib/meta/marketing";
import { reenviarFalhas } from "@/lib/meta/capi";
import { encerrarCliquesSemContato } from "@/lib/atribuicao";
import { aplicarRetencao } from "@/lib/retencao";
import { abrirTarefasDeRenovacao, gerarFaturasDoMes } from "@/lib/financeiro";
import { gerarRelatoriosDoMesPassado } from "@/lib/relatorio";

// Roda em São Paulo, junto do banco.
export const preferredRegion = "gru1";

/**
 * Rotina diária: puxa o gasto dos últimos 7 dias de cada cliente, reenvia os
 * eventos que falharam e encerra os cliques sem contato.
 *
 * Na Vercel, agendar em vercel.json. O CRON_SECRET protege a rota, porque ela
 * fica num endereço público.
 */
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  const enviado =
    request.headers.get("authorization")?.replace("Bearer ", "") ??
    request.nextUrl.searchParams.get("secret");

  if (segredo && enviado !== segredo) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  // Faturas do mês: idempotente, então rodar todo dia não duplica nada.
  const faturas = await gerarFaturasDoMes();

  // Dia 1: relatório do mês fechado já gerado, com a tarefa de envio na agenda.
  const relatorios = await gerarRelatoriosDoMesPassado();

  // Contrato vencendo: a conversa de renovação entra na agenda 30 dias antes.
  const renovacoes = await abrirTarefasDeRenovacao();

  const clientes = await prisma.cliente.findMany({ where: { ativo: true } });
  const resultado = [];

  for (const cliente of clientes) {
    const gastos = await sincronizarGastos(cliente.id);
    const capi = await reenviarFalhas(cliente.id);
    const cliques = await encerrarCliquesSemContato(cliente.id);
    const retencao = await aplicarRetencao(cliente.id);
    resultado.push({
      cliente: cliente.nome,
      gastos,
      capi,
      cliquesEncerrados: cliques,
      retencao,
    });
  }

  return NextResponse.json({
    rodadoEm: new Date().toISOString(),
    faturas,
    relatorios: relatorios.length,
    renovacoes,
    resultado,
  });
}
