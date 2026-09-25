import "server-only";
import { prisma } from "./prisma";
import { dataPuraDe, FUSO_PADRAO, instanteLocal } from "./datas";
import { quantidade, tipoDoResultado, type Acoes } from "./resultados";
import { rankingPorVenda, recomendar, type AnuncioPeriodo } from "./inteligencia";
import { funilDoAnuncio, type DiagnosticoFunil } from "./funil-anuncio";

/**
 * Números por anúncio, do jeito que a inteligência precisa: o período pedido e
 * o anterior do mesmo tamanho, com o que o Meta contou e o que a plataforma
 * viu chegar de verdade.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

function instantes(de: Date, ate: Date, fuso: string) {
  const d = (x: Date) => [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()] as const;
  const inicio = instanteLocal(...d(de), 0, 0, fuso);
  const fim = new Date(instanteLocal(...d(new Date(ate.getTime() + DIA_MS)), 0, 0, fuso).getTime() - 1);
  return { inicio, fim };
}

export async function anunciosDoPeriodo(
  clienteId: string,
  de: Date,
  ate: Date,
  fuso: string,
): Promise<AnuncioPeriodo[]> {
  const { inicio, fim } = instantes(de, ate, fuso);
  const [linhas, leads, visitas] = await Promise.all([
    prisma.gasto.findMany({
      where: { clienteId, dia: { gte: de, lte: ate } },
      select: {
        adId: true,
        adNome: true,
        campaignNome: true,
        objetivo: true,
        otimizacao: true,
        valor: true,
        impressoes: true,
        cliquesLink: true,
        cliques: true,
        acoes: true,
      },
    }),
    // Contatos que a plataforma registrou, pelo anúncio do clique que os trouxe.
    prisma.lead.findMany({
      where: {
        clienteId,
        arquivadoEm: null,
        criadoEm: { gte: inicio, lte: fim },
        clique: { adId: { not: null } },
      },
      select: { status: true, valorVenda: true, clique: { select: { adId: true } } },
    }),
    /* Visitas que o script registrou por anúncio. É o elo que falta entre o
       clique que o Meta cobra e o contato que chega: sem ele não dá para saber
       se a perda foi no criativo, no caminho até a página, ou na página. */
    prisma.clique.groupBy({
      by: ["adId"],
      where: { clienteId, adId: { not: null }, criadoEm: { gte: inicio, lte: fim } },
      _count: { _all: true },
    }),
  ]);

  const visitasPorAnuncio = new Map(visitas.map((v) => [v.adId!, v._count._all]));

  const doPainel = new Map<string, { contatos: number; fechados: number; receita: number }>();
  for (const l of leads) {
    const adId = l.clique?.adId;
    if (!adId) continue;
    const item = doPainel.get(adId) ?? { contatos: 0, fechados: 0, receita: 0 };
    item.contatos++;
    if (l.status === "FECHADO") {
      item.fechados++;
      item.receita += l.valorVenda ? Number(l.valorVenda) : 0;
    }
    doPainel.set(adId, item);
  }

  type Acumulado = {
    nome: string | null;
    campanha: string | null;
    objetivo: string | null;
    otimizacao: string | null;
    gastoPorOtimizacao: Map<string, number>;
    gasto: number;
    impressoes: number;
    cliquesLink: number;
    acoes: Acoes;
  };
  const mapa = new Map<string, Acumulado>();

  for (const l of linhas) {
    const a =
      mapa.get(l.adId) ??
      ({
        nome: null,
        campanha: null,
        objetivo: null,
        otimizacao: null,
        gastoPorOtimizacao: new Map(),
        gasto: 0,
        impressoes: 0,
        cliquesLink: 0,
        acoes: {} as Acoes,
      } satisfies Acumulado);
    a.nome ??= l.adNome;
    a.campanha ??= l.campaignNome;
    const valor = Number(l.valor);
    a.gasto += valor;
    a.impressoes += l.impressoes;
    // Cliques no link é o que interessa; sem ele (linha antiga), vale o total.
    a.cliquesLink += l.cliquesLink || l.cliques;
    for (const [k, v] of Object.entries((l.acoes as Acoes | null) ?? {})) a.acoes[k] = (a.acoes[k] ?? 0) + v;
    const chave = `${l.otimizacao ?? ""}|${l.objetivo ?? ""}`;
    a.gastoPorOtimizacao.set(chave, (a.gastoPorOtimizacao.get(chave) ?? 0) + valor);
    mapa.set(l.adId, a);
  }

  return [...mapa.entries()].map(([adId, a]) => {
    // Conjunto que mais gastou decide o que conta como resultado deste anúncio.
    const [otimizacao, objetivo] = [...a.gastoPorOtimizacao.entries()]
      .sort((x, y) => y[1] - x[1])[0][0]
      .split("|")
      .map((x) => x || null);
    // Alcance só existe pronto no Meta e não se soma por dia: aqui o resultado
    // vira impressões, senão a campanha de alcance apareceria zerada.
    const bruto = tipoDoResultado(otimizacao, objetivo, a.acoes);
    const tipo = bruto === "alcance" ? "impressoes" : bruto;
    const painel = doPainel.get(adId);
    return {
      adId,
      nome: a.nome ?? adId,
      campanha: a.campanha,
      tipo,
      gasto: a.gasto,
      impressoes: a.impressoes,
      cliquesLink: a.cliquesLink,
      resultados: quantidade(tipo, {
        acoes: a.acoes,
        cliquesLink: a.cliquesLink,
        impressoes: a.impressoes,
        otimizacao,
        objetivo,
      }),
      visitas: visitasPorAnuncio.get(adId) ?? 0,
      contatosPainel: painel?.contatos ?? 0,
      fechados: painel?.fechados ?? 0,
      receita: painel?.receita ?? 0,
    };
  });
}

/** A leitura pronta para a tela: período pedido contra o anterior do mesmo tamanho. */
export async function inteligenciaDoCliente(clienteId: string, de: Date, ate: Date, fuso = FUSO_PADRAO) {
  const dias = Math.round((ate.getTime() - de.getTime()) / DIA_MS) + 1;
  const antesAte = new Date(de.getTime() - DIA_MS);
  const antesDe = new Date(de.getTime() - dias * DIA_MS);

  const [atual, anterior] = await Promise.all([
    anunciosDoPeriodo(clienteId, de, ate, fuso),
    anunciosDoPeriodo(clienteId, antesDe, antesAte, fuso),
  ]);

  /* Se nenhum anúncio trouxe visita registrada, o script não está no ar: sem
     isso o funil acusaria uma página que nunca foi medida. */
  const paginaRastreada = atual.some((a) => a.visitas > 0);

  const funis = new Map<string, DiagnosticoFunil>();
  for (const a of atual) {
    if (a.gasto > 0) funis.set(a.adId, funilDoAnuncio(a, paginaRastreada));
  }

  return {
    ...recomendar(atual, anterior),
    vendas: rankingPorVenda(atual),
    funis,
    gargalos: atual
      .filter((a) => funis.get(a.adId)?.gargalo)
      .sort((x, y) => y.gasto - x.gasto)
      .map((a) => ({ anuncio: a, funil: funis.get(a.adId)! })),
    anuncios: atual.length,
    dias,
  };
}

/** Datas puras do período a partir dos instantes que a tela já calcula. */
export function periodoPuro(de: Date, ate: Date, fuso = FUSO_PADRAO) {
  return { de: dataPuraDe(de, fuso), ate: dataPuraDe(ate, fuso) };
}
