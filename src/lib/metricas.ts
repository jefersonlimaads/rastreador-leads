import "server-only";
import { prisma } from "./prisma";
import { dataPuraDe, FUSO_PADRAO } from "./datas";

/**
 * Fórmulas do escopo, num lugar só:
 *   CPL  = gasto do período ÷ leads do período
 *   CAC  = gasto do período ÷ leads fechados do período
 *   ROAS = soma das vendas ÷ gasto do período
 *
 * Leads com atribuição exata ou provável contam no anúncio; desconhecida só no
 * total do cliente.
 *
 * DOIS MODOS DE LER O MESMO PERÍODO
 *
 * Coorte — os contatos que CHEGARAM no período, e o que aconteceu com eles
 * depois. Um lead de 1º de setembro que fechou em 20 pertence a setembro. É o
 * modo para julgar campanha: relaciona a verba gasta com o que ela trouxe.
 *
 * Período — o que ACONTECEU no período. A mesma venda de 20 de setembro entra
 * em setembro mesmo que o lead seja de agosto. É o modo para falar de
 * faturamento do mês.
 *
 * Misturar os dois produz relatório errado sem ninguém perceber: some venda
 * que existiu, ou aparece venda que a verba do período não pagou. Por isso o
 * modo é obrigatório na chamada e fica escrito na tela.
 */

export type ModoAnalise = "coorte" | "periodo";

export const ROTULO_MODO: Record<ModoAnalise, { curto: string; explica: string }> = {
  coorte: {
    curto: "Contatos que chegaram",
    explica:
      "Vendas contadas no período em que o contato chegou, mesmo que tenham fechado depois. É como se julga a campanha.",
  },
  periodo: {
    curto: "O que aconteceu no mês",
    explica:
      "Vendas contadas no período em que fecharam, mesmo que o contato seja de antes. É como se fala de faturamento.",
  },
};

export type LinhaMetrica = {
  chave: string;
  rotulo: string;
  leads: number;
  leadsExatos: number;
  fechados: number;
  receita: number;
  gasto: number;
  cpl: number | null;
  cac: number | null;
  roas: number | null;
};

export type Nivel = "ad" | "adset" | "campaign";

export async function metricasPorAnuncio(params: {
  clienteId: string;
  de: Date;
  ate: Date;
  nivel?: Nivel;
  fuso?: string;
  modo?: ModoAnalise;
}): Promise<{
  linhas: LinhaMetrica[];
  total: LinhaMetrica;
  semAtribuicao: number;
  /** Vendas fechadas sem valor lançado: fazem a receita virar piso. */
  vendasSemValor: number;
  /** Contatos que ainda não fecharam nem se perderam: a taxa vai mudar. */
  emAberto: number;
  /** O modo usado, para a tela dizer qual pergunta está respondendo. */
  modo: ModoAnalise;
  /** No modo período: vendas que ficaram de fora por não terem data de fechamento. */
  vendasSemDataFechamento: number;
}> {
  const { clienteId, de, ate, nivel = "ad", fuso = FUSO_PADRAO, modo = "coorte" } = params;

  const campos = {
    status: true,
    atribuicao: true,
    valorVenda: true,
    clique: { select: { adId: true, adsetId: true, campaignId: true, utmContent: true, utmCampaign: true } },
  } as const;

  /* Chegada é sempre pelo período: contato que entrou é movimento do período
     nos dois modos. O que muda é de onde vem a venda. */
  const chegaram = await prisma.lead.findMany({
    where: { clienteId, arquivadoEm: null, criadoEm: { gte: de, lte: ate } },
    select: campos,
  });

  /* Venda sem data de fechamento não entra no modo período — e some em
     silêncio se ninguém contar. Lead fechado antes de o sistema registrar a
     data é o caso comum, e faz a leitura do mês parecer um desastre. */
  const vendasSemDataFechamento =
    modo === "periodo"
      ? await prisma.lead.count({
          where: { clienteId, arquivadoEm: null, status: "FECHADO", fechadoEm: null },
        })
      : 0;

  const fecharam =
    modo === "periodo"
      ? await prisma.lead.findMany({
          where: {
            clienteId,
            arquivadoEm: null,
            status: "FECHADO",
            fechadoEm: { gte: de, lte: ate },
          },
          select: campos,
        })
      : chegaram.filter((l) => l.status === "FECHADO");

  /* O laço abaixo conta contato de `chegaram` e venda de `fecharam`. No modo
     coorte as duas listas são a mesma origem, e nada muda. */
  const vendas = new Set(fecharam);
  const leads = [...chegaram, ...fecharam.filter((l) => !chegaram.includes(l))];

  // Gasto é por dia de calendário: compara com os dias do período no fuso, não
  // com os instantes — o fim do período em UTC já cai no dia seguinte.
  const gastos = await prisma.gasto.findMany({
    where: { clienteId, dia: { gte: dataPuraDe(de, fuso), lte: dataPuraDe(ate, fuso) } },
  });

  const chaveDe = (c: {
    adId: string | null;
    adsetId: string | null;
    campaignId: string | null;
  } | null) => {
    if (!c) return null;
    if (nivel === "ad") return c.adId;
    if (nivel === "adset") return c.adsetId;
    return c.campaignId;
  };

  const mapa = new Map<string, LinhaMetrica>();
  const linha = (chave: string, rotulo: string) => {
    let l = mapa.get(chave);
    if (!l) {
      l = {
        chave,
        rotulo,
        leads: 0,
        leadsExatos: 0,
        fechados: 0,
        receita: 0,
        gasto: 0,
        cpl: null,
        cac: null,
        roas: null,
      };
      mapa.set(chave, l);
    }
    return l;
  };

  let semAtribuicao = 0;
  /* O que a camada de indicadores precisa para dizer o quanto o número se
     sustenta: venda sem valor lançado, e contato ainda em aberto. */
  let vendasSemValor = 0;
  let emAberto = 0;
  const total = linha("__total__", "Total do cliente");

  for (const lead of leads) {
    const chave = chaveDe(lead.clique);
    const valor = lead.valorVenda ? Number(lead.valorVenda) : 0;
    // Contato conta quando chegou no período; venda, conforme o modo.
    const chegou = chegaram.includes(lead);
    const vendeu = vendas.has(lead);

    if (vendeu && !lead.valorVenda) vendasSemValor++;
    if (chegou && lead.status !== "FECHADO" && lead.status !== "PERDIDO") emAberto++;

    if (chegou) {
      total.leads++;
      if (lead.atribuicao === "EXATA") total.leadsExatos++;
    }
    if (vendeu) {
      total.fechados++;
      total.receita += valor;
    }

    if (!chave || lead.atribuicao === "DESCONHECIDA") {
      if (chegou) semAtribuicao++;
      continue;
    }

    const rotulo =
      nivel === "ad"
        ? (lead.clique?.utmContent ?? chave)
        : nivel === "campaign"
          ? (lead.clique?.utmCampaign ?? chave)
          : chave;

    const l = linha(chave, rotulo);
    if (chegou) {
      l.leads++;
      if (lead.atribuicao === "EXATA") l.leadsExatos++;
    }
    if (vendeu) {
      l.fechados++;
      l.receita += valor;
    }
  }

  for (const gasto of gastos) {
    const chave =
      nivel === "ad" ? gasto.adId : nivel === "adset" ? gasto.adsetId : gasto.campaignId;
    const valor = Number(gasto.valor);
    total.gasto += valor;
    if (!chave) continue;
    const rotulo =
      nivel === "ad"
        ? (gasto.adNome ?? chave)
        : nivel === "adset"
          ? (gasto.adsetNome ?? chave)
          : (gasto.campaignNome ?? chave);
    const l = linha(chave, rotulo);
    // O nome vindo do Meta é melhor que o id que o lead trouxe: troca quando houver.
    if (l.rotulo === chave && rotulo !== chave) l.rotulo = rotulo;
    l.gasto += valor;
  }

  const calcular = (l: LinhaMetrica) => {
    l.cpl = l.leads > 0 && l.gasto > 0 ? l.gasto / l.leads : null;
    l.cac = l.fechados > 0 && l.gasto > 0 ? l.gasto / l.fechados : null;
    l.roas = l.gasto > 0 ? l.receita / l.gasto : null;
    return l;
  };

  const linhas = [...mapa.values()]
    .filter((l) => l.chave !== "__total__")
    .map(calcular)
    .sort((a, b) => b.leads - a.leads || b.gasto - a.gasto);

  return {
    linhas,
    total: calcular(total),
    semAtribuicao,
    vendasSemValor,
    emAberto,
    modo,
    vendasSemDataFechamento,
  };
}
