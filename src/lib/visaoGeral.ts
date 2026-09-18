import "server-only";
import { prisma } from "./prisma";
import { REGRAS, STATUS_ABERTOS } from "./regras";
import { inicioDoDia, periodoPadrao } from "./datas";

/**
 * Visão de quem gere vários clientes: uma linha por cliente, com o que decide
 * onde mexer hoje. Tudo em duas consultas, não uma por cliente, senão a tela
 * fica lenta assim que a carteira crescer.
 */
export type LinhaCliente = {
  id: string;
  nome: string;
  fuso: string;
  leadsHoje: number;
  leadsPeriodo: number;
  fechadosPeriodo: number;
  receita: number;
  gasto: number;
  cpl: number | null;
  cac: number | null;
  roas: number | null;
  semResposta: number;
  followUp: number;
  cliquesPendentes: number;
  temCredenciaisMeta: boolean;
  gastoSincronizadoEm: Date | null;
};

export async function visaoGeral(dias = 7): Promise<LinhaCliente[]> {
  const clientes = await prisma.cliente.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
  });
  if (clientes.length === 0) return [];

  const ids = clientes.map((c) => c.id);
  const agora = new Date();
  const limiteSemResposta = new Date(agora.getTime() - REGRAS.destaqueNovoHoras * 60 * 60 * 1000);
  const limiteFollowUp = new Date(agora.getTime() - REGRAS.followUpDias * 24 * 60 * 60 * 1000);

  // O período mais largo entre todos os fusos, filtrado por cliente depois.
  const { de, ate } = periodoPadrao(dias);

  const [leads, gastos, cliques, ultimasSyncs] = await Promise.all([
    prisma.lead.findMany({
      where: { clienteId: { in: ids }, arquivadoEm: null, criadoEm: { gte: de, lte: ate } },
      select: {
        clienteId: true,
        criadoEm: true,
        status: true,
        valorVenda: true,
        eventos: { orderBy: { criadoEm: "desc" }, take: 1, select: { criadoEm: true } },
      },
    }),
    prisma.gasto.groupBy({
      by: ["clienteId"],
      where: { clienteId: { in: ids }, dia: { gte: de, lte: ate } },
      _sum: { valor: true },
    }),
    prisma.clique.groupBy({
      by: ["clienteId"],
      where: { clienteId: { in: ids }, status: "PENDENTE", lead: null },
      _count: { _all: true },
    }),
    prisma.gasto.groupBy({
      by: ["clienteId"],
      where: { clienteId: { in: ids } },
      _max: { atualizadoEm: true },
    }),
  ]);

  return clientes.map((cliente) => {
    const inicioHoje = inicioDoDia(agora, cliente.fuso);
    const meus = leads.filter((l) => l.clienteId === cliente.id);

    let leadsHoje = 0;
    let fechados = 0;
    let receita = 0;
    let semResposta = 0;
    let followUp = 0;

    for (const lead of meus) {
      if (lead.criadoEm >= inicioHoje) leadsHoje++;
      if (lead.status === "FECHADO") {
        fechados++;
        receita += lead.valorVenda ? Number(lead.valorVenda) : 0;
      }

      const aberto = (STATUS_ABERTOS as readonly string[]).includes(lead.status);
      if (!aberto) continue;

      if (lead.status === "NOVO" && lead.criadoEm < limiteSemResposta) semResposta++;
      const ultimo = lead.eventos[0]?.criadoEm ?? lead.criadoEm;
      if (ultimo < limiteFollowUp) followUp++;
    }

    const gasto = Number(gastos.find((g) => g.clienteId === cliente.id)?._sum.valor ?? 0);
    const leadsPeriodo = meus.length;

    return {
      id: cliente.id,
      nome: cliente.nome,
      fuso: cliente.fuso,
      leadsHoje,
      leadsPeriodo,
      fechadosPeriodo: fechados,
      receita,
      gasto,
      cpl: leadsPeriodo > 0 && gasto > 0 ? gasto / leadsPeriodo : null,
      cac: fechados > 0 && gasto > 0 ? gasto / fechados : null,
      roas: gasto > 0 ? receita / gasto : null,
      semResposta,
      followUp,
      cliquesPendentes: cliques.find((c) => c.clienteId === cliente.id)?._count._all ?? 0,
      temCredenciaisMeta: Boolean(cliente.pixelId && cliente.capiToken && cliente.marketingToken),
      gastoSincronizadoEm:
        ultimasSyncs.find((s) => s.clienteId === cliente.id)?._max.atualizadoEm ?? null,
    };
  });
}
