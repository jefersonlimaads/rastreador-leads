import "server-only";
import { prisma } from "./prisma";
import { metricasPorAnuncio, type LinhaMetrica } from "./metricas";
import { dataPuraDe, FUSO_PADRAO, hojeComoDataPura, instanteLocal } from "./datas";
import { gerarToken } from "./confirmacao";
import { alcancePorCampanha } from "./meta/marketing";
import { conversas, leadsMeta, resultadosPorCampanha, type Acoes, type ResultadoCampanha } from "./resultados";

/**
 * Relatório de resultados para o cliente final.
 *
 * O período é de dias de calendário no fuso do cliente ("2026-09-01" a
 * "2026-09-30"). Leads e visitas entram pelo instante em que chegaram; gasto,
 * pelo dia em que o Meta o registrou. Os números seguem as mesmas fórmulas da
 * tela de Anúncios, para o cliente nunca ver um CPL diferente do que você vê.
 */

const DIA_MS = 24 * 60 * 60 * 1000;
export const MAX_DIAS = 366;

/** "2026-09-01" → meia-noite UTC daquele dia (data pura). */
export function lerDia(texto: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const d = new Date(texto + "T00:00:00Z");
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== texto ? null : d;
}

export function diaISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function somarDias(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DIA_MS);
}

export function validarPeriodo(de: string, ate: string): { de: Date; ate: Date } | { erro: string } {
  const inicio = lerDia(de);
  const fim = lerDia(ate);
  if (!inicio || !fim) return { erro: "Escolha as duas datas do período." };
  if (fim < inicio) return { erro: "A data final vem antes da inicial." };
  if ((fim.getTime() - inicio.getTime()) / DIA_MS + 1 > MAX_DIAS) {
    return { erro: "O período vai até um ano." };
  }
  return { de: inicio, ate: fim };
}

/** Atalhos da tela: os períodos que mais se mandam para cliente. */
export function periodosSugeridos(fuso: string = FUSO_PADRAO) {
  const hoje = hojeComoDataPura(fuso);
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth();
  const inicioMes = new Date(Date.UTC(ano, mes, 1));
  const inicioMesPassado = new Date(Date.UTC(ano, mes - 1, 1));
  const fimMesPassado = somarDias(inicioMes, -1);
  return [
    { rotulo: "Últimos 7 dias", de: diaISO(somarDias(hoje, -6)), ate: diaISO(hoje) },
    { rotulo: "Últimos 30 dias", de: diaISO(somarDias(hoje, -29)), ate: diaISO(hoje) },
    { rotulo: "Este mês", de: diaISO(inicioMes), ate: diaISO(hoje) },
    { rotulo: "Mês passado", de: diaISO(inicioMesPassado), ate: diaISO(fimMesPassado) },
  ];
}

export type Totais = {
  investimento: number;
  impressoes: number;
  cliquesAnuncio: number;
  visitas: number;
  /** Contatos que a plataforma registrou (página rastreada ou cadastro manual). */
  leads: number;
  /** Conversas iniciadas em anúncios de clique para o WhatsApp, contadas pelo Meta. */
  conversas: number;
  /** Leads que o Meta diz ter gerado: formulário instantâneo ou evento do pixel. */
  leadsMeta: number;
  /** Contatos no total: os da plataforma mais as conversas do WhatsApp. */
  contatos: number;
  fechados: number;
  perdidos: number;
  receita: number;
  cpl: number | null;
  cac: number | null;
  roas: number | null;
  ctr: number | null;
  cpc: number | null;
  taxaConversa: number | null;
  taxaFechamento: number | null;
};

/** Instantes que cobrem os dias do período, no fuso do cliente. */
function instantes(de: Date, ate: Date, fuso: string) {
  const d = (x: Date) => [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()] as const;
  const inicio = instanteLocal(...d(de), 0, 0, fuso);
  const fim = new Date(instanteLocal(...d(somarDias(ate, 1)), 0, 0, fuso).getTime() - 1);
  return { inicio, fim };
}

const razao = (a: number, b: number) => (b > 0 ? a / b : null);

async function totais(clienteId: string, de: Date, ate: Date, fuso: string): Promise<Totais> {
  const { inicio, fim } = instantes(de, ate, fuso);
  const [gasto, visitas, leads] = await Promise.all([
    prisma.gasto.findMany({
      where: { clienteId, dia: { gte: de, lte: ate } },
      select: { valor: true, impressoes: true, cliques: true, acoes: true },
    }),
    prisma.clique.count({ where: { clienteId, criadoEm: { gte: inicio, lte: fim } } }),
    prisma.lead.findMany({
      where: { clienteId, arquivadoEm: null, criadoEm: { gte: inicio, lte: fim } },
      select: { status: true, valorVenda: true },
    }),
  ]);

  const investimento = gasto.reduce((s, g) => s + Number(g.valor), 0);
  const impressoes = gasto.reduce((s, g) => s + g.impressoes, 0);
  const cliquesAnuncio = gasto.reduce((s, g) => s + g.cliques, 0);
  const totalConversas = gasto.reduce((s, g) => s + conversas(g.acoes as Acoes | null), 0);
  const totalLeadsMeta = gasto.reduce((s, g) => s + leadsMeta(g.acoes as Acoes | null), 0);
  const contatos = leads.length + totalConversas;
  const fechados = leads.filter((l) => l.status === "FECHADO");
  const receita = fechados.reduce((s, l) => s + (l.valorVenda ? Number(l.valorVenda) : 0), 0);

  return {
    investimento,
    impressoes,
    cliquesAnuncio,
    visitas,
    leads: leads.length,
    conversas: totalConversas,
    leadsMeta: totalLeadsMeta,
    contatos,
    fechados: fechados.length,
    perdidos: leads.filter((l) => l.status === "PERDIDO").length,
    receita,
    cpl: investimento > 0 ? razao(investimento, contatos) : null,
    cac: investimento > 0 ? razao(investimento, fechados.length) : null,
    roas: receita > 0 ? razao(receita, investimento) : null,
    ctr: razao(cliquesAnuncio, impressoes),
    cpc: investimento > 0 ? razao(investimento, cliquesAnuncio) : null,
    taxaConversa: razao(leads.length, visitas),
    taxaFechamento: razao(fechados.length, contatos),
  };
}

export type Relatorio = Awaited<ReturnType<typeof montarRelatorio>>;

export async function montarRelatorio(clienteId: string, de: Date, ate: Date) {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { nome: true, fuso: true, funil: true, agencia: { select: { nome: true } } },
  });
  if (!cliente) return null;
  const fuso = cliente.fuso ?? FUSO_PADRAO;

  const dias = Math.round((ate.getTime() - de.getTime()) / DIA_MS) + 1;
  // Período anterior do mesmo tamanho, colado neste: é a base da comparação.
  const antesAte = somarDias(de, -1);
  const antesDe = somarDias(de, -dias);
  const { inicio, fim } = instantes(de, ate, fuso);

  const [atual, anterior, gastosDia, leads, campanhas, anuncios, doMeta] = await Promise.all([
    totais(clienteId, de, ate, fuso),
    totais(clienteId, antesDe, antesAte, fuso),
    prisma.gasto.findMany({
      where: { clienteId, dia: { gte: de, lte: ate } },
      select: { dia: true, valor: true, acoes: true },
    }),
    prisma.lead.findMany({
      where: { clienteId, arquivadoEm: null, criadoEm: { gte: inicio, lte: fim } },
      select: { criadoEm: true, status: true, clique: { select: { interesse: true } } },
    }),
    metricasPorAnuncio({ clienteId, de: inicio, ate: fim, nivel: "campaign", fuso }),
    metricasPorAnuncio({ clienteId, de: inicio, ate: fim, nivel: "ad", fuso }),
    campanhasDoMeta(clienteId, de, ate),
  ]);

  // Série diária: um ponto por dia do período, mesmo sem movimento.
  const porDia = new Map<string, { dia: string; investimento: number; leads: number }>();
  for (let i = 0; i < dias; i++) {
    const dia = diaISO(somarDias(de, i));
    porDia.set(dia, { dia, investimento: 0, leads: 0 });
  }
  for (const g of gastosDia) {
    const p = porDia.get(diaISO(g.dia));
    if (p) {
      p.investimento += Number(g.valor);
      p.leads += conversas(g.acoes as Acoes | null);
    }
  }
  const status = new Map<string, number>();
  const interesses = new Map<string, number>();
  for (const l of leads) {
    const p = porDia.get(diaISO(dataPuraDe(l.criadoEm, fuso)));
    if (p) p.leads++;
    status.set(l.status, (status.get(l.status) ?? 0) + 1);
    const interesse = l.clique?.interesse?.trim();
    if (interesse) interesses.set(interesse, (interesses.get(interesse) ?? 0) + 1);
  }

  const principais = (linhas: LinhaMetrica[], n: number) =>
    linhas.filter((l) => l.leads > 0 || l.gasto > 0).slice(0, n);

  return {
    cliente: { nome: cliente.nome, funil: cliente.funil },
    agencia: cliente.agencia.nome,
    fuso,
    periodo: { de: diaISO(de), ate: diaISO(ate), dias },
    anterior: { de: diaISO(antesDe), ate: diaISO(antesAte), totais: anterior },
    atual,
    porDia: [...porDia.values()],
    status: [...status.entries()].map(([s, n]) => ({ status: s, leads: n })),
    interesses: [...interesses.entries()]
      .map(([rotulo, leads]) => ({ rotulo, leads }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 6),
    campanhas: principais(campanhas.linhas, 8),
    resultados: doMeta.campanhas,
    alcanceTotal: doMeta.alcanceTotal,
    anuncios: principais(anuncios.linhas, 5),
    semAtribuicao: campanhas.semAtribuicao,
  };
}

/**
 * Resultado de cada campanha como o Meta registra, com os contatos que a
 * plataforma viu chegar da mesma campanha ao lado — o "Meta contou X, chegaram
 * Y" que mostra se o pixel está contando certo.
 */
export async function campanhasDoMeta(clienteId: string, de: Date, ate: Date) {
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { fuso: true } });
  const fuso = cliente?.fuso ?? FUSO_PADRAO;
  const { inicio, fim } = instantes(de, ate, fuso);

  const [linhas, alcance, rastreados] = await Promise.all([
    prisma.gasto.findMany({
      where: { clienteId, dia: { gte: de, lte: ate } },
      select: {
        campaignId: true,
        campaignNome: true,
        objetivo: true,
        otimizacao: true,
        valor: true,
        impressoes: true,
        cliquesLink: true,
        acoes: true,
        valoresAcoes: true,
      },
    }),
    alcancePorCampanha(clienteId, diaISO(de), diaISO(ate)),
    prisma.lead.groupBy({
      by: ["cliqueId"],
      where: { clienteId, arquivadoEm: null, criadoEm: { gte: inicio, lte: fim }, cliqueId: { not: null } },
      _count: true,
    }),
  ]);

  // Leads rastreados pela página, contados pela campanha do clique que os trouxe.
  const cliques = await prisma.clique.findMany({
    where: { id: { in: rastreados.map((r) => r.cliqueId!) } },
    select: { campaignId: true },
  });
  const porCampanha = new Map<string, number>();
  for (const c of cliques) {
    if (c.campaignId) porCampanha.set(c.campaignId, (porCampanha.get(c.campaignId) ?? 0) + 1);
  }

  const campanhas: (ResultadoCampanha & { contatosPainel: number })[] = resultadosPorCampanha(
    linhas.map((l) => ({
      ...l,
      valor: Number(l.valor),
      acoes: l.acoes as Acoes | null,
      valoresAcoes: l.valoresAcoes as Acoes | null,
    })),
    alcance.porCampanha,
  ).map((c) => ({ ...c, contatosPainel: porCampanha.get(c.campaignId) ?? 0 }));

  return { campanhas, alcanceTotal: alcance.total };
}

// ——— Links enviados ao cliente ———

export async function criarLinkRelatorio(dados: {
  clienteId: string;
  de: Date;
  ate: Date;
  comentario: string | null;
  criadoPor: string;
}) {
  return prisma.relatorio.create({ data: { ...dados, token: gerarToken() } });
}

export async function relatoriosDoCliente(clienteId: string) {
  return prisma.relatorio.findMany({
    where: { clienteId },
    orderBy: { criadoEm: "desc" },
    take: 20,
  });
}

export async function relatorioPorToken(token: string) {
  if (!token || token.length < 32) return null;
  return prisma.relatorio.findUnique({ where: { token } });
}

export async function registrarVisualizacaoRelatorio(id: string) {
  await prisma.relatorio.update({
    where: { id },
    data: { visualizacoes: { increment: 1 }, visualizadoEm: new Date() },
  });
}
