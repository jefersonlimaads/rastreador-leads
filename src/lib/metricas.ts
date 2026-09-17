import "server-only";
import { prisma } from "./prisma";

/**
 * Fórmulas do escopo, num lugar só:
 *   CPL  = gasto do período ÷ leads do período
 *   CAC  = gasto do período ÷ leads fechados do período
 *   ROAS = soma das vendas ÷ gasto do período
 *
 * O lead entra no período em que foi criado, e a venda entra no período do lead,
 * não no do fechamento. Assim as três métricas falam do mesmo grupo de pessoas.
 * Leads com atribuição exata ou provável contam no anúncio; desconhecida só no
 * total do cliente.
 */

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
}): Promise<{ linhas: LinhaMetrica[]; total: LinhaMetrica; semAtribuicao: number }> {
  const { clienteId, de, ate, nivel = "ad" } = params;

  const leads = await prisma.lead.findMany({
    where: { clienteId, arquivadoEm: null, criadoEm: { gte: de, lte: ate } },
    select: {
      status: true,
      atribuicao: true,
      valorVenda: true,
      clique: { select: { adId: true, adsetId: true, campaignId: true, utmContent: true, utmCampaign: true } },
    },
  });

  const gastos = await prisma.gasto.findMany({
    where: { clienteId, dia: { gte: de, lte: ate } },
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
  const total = linha("__total__", "Total do cliente");

  for (const lead of leads) {
    const chave = chaveDe(lead.clique);
    const valor = lead.valorVenda ? Number(lead.valorVenda) : 0;

    total.leads++;
    if (lead.atribuicao === "EXATA") total.leadsExatos++;
    if (lead.status === "FECHADO") {
      total.fechados++;
      total.receita += valor;
    }

    if (!chave || lead.atribuicao === "DESCONHECIDA") {
      semAtribuicao++;
      continue;
    }

    const rotulo =
      nivel === "ad"
        ? (lead.clique?.utmContent ?? chave)
        : nivel === "campaign"
          ? (lead.clique?.utmCampaign ?? chave)
          : chave;

    const l = linha(chave, rotulo);
    l.leads++;
    if (lead.atribuicao === "EXATA") l.leadsExatos++;
    if (lead.status === "FECHADO") {
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

  return { linhas, total: calcular(total), semAtribuicao };
}

/** Período padrão do painel: últimos 30 dias, fechando hoje. */
export function periodoPadrao(dias = 30) {
  const ate = new Date();
  ate.setHours(23, 59, 59, 999);
  const de = new Date(ate);
  de.setDate(de.getDate() - (dias - 1));
  de.setHours(0, 0, 0, 0);
  return { de, ate };
}
