import "server-only";
import { prisma } from "../prisma";
import { decifrar } from "../cripto";

/**
 * Entrada de gasto pela API de Marketing do Meta.
 *
 * Cada sincronização rebusca os últimos 7 dias e sobrescreve os registros,
 * porque o Meta revisa o gasto depois do fechamento do dia. Puxar só o dia
 * anterior deixa o número errado no painel.
 */

const VERSAO_API = process.env.META_API_VERSION ?? "v26.0";
const DIAS_REBUSCA = 7;

type LinhaInsights = {
  date_start: string;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  inline_link_clicks?: string;
  objective?: string;
  optimization_goal?: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
  video_thruplay_watched_actions?: { action_type: string; value: string }[];
};

/** Lista do Meta [{ action_type, value }] para { tipo: número }. */
function mapaDeAcoes(lista: { action_type: string; value: string }[] | undefined) {
  const mapa: Record<string, number> = {};
  for (const a of lista ?? []) {
    const n = Number(a.value);
    if (Number.isFinite(n)) mapa[a.action_type] = (mapa[a.action_type] ?? 0) + n;
  }
  return mapa;
}

const CAMPOS = [
  "ad_id",
  "ad_name",
  "adset_id",
  "adset_name",
  "campaign_id",
  "campaign_name",
  "objective",
  "optimization_goal",
  "spend",
  "impressions",
  "clicks",
  "inline_link_clicks",
  "actions",
  "action_values",
  "video_thruplay_watched_actions",
].join(",");

function dataISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function sincronizarGastos(clienteId: string, dias = DIAS_REBUSCA) {
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return { erro: "Cliente não encontrado" };
  const token = decifrar(cliente.marketingToken);
  if (!cliente.contaAnunciosId || !token) {
    return { erro: "Cliente sem conta de anúncios ou token da API de Marketing" };
  }

  const ate = new Date();
  const de = new Date();
  de.setDate(de.getDate() - (dias - 1));

  const params = new URLSearchParams({
    level: "ad",
    fields: CAMPOS,
    time_increment: "1",
    time_range: JSON.stringify({ since: dataISO(de), until: dataISO(ate) }),
    limit: "500",
    access_token: token,
  });

  const conta = cliente.contaAnunciosId.startsWith("act_")
    ? cliente.contaAnunciosId
    : `act_${cliente.contaAnunciosId}`;

  let url: string | null = `https://graph.facebook.com/${VERSAO_API}/${conta}/insights?${params}`;
  let gravados = 0;

  try {
    while (url) {
      const resposta = await fetch(url);
      if (!resposta.ok) {
        const corpo = await resposta.text();
        console.error("[meta/marketing] erro", resposta.status, corpo.slice(0, 500));
        return { erro: `Meta respondeu ${resposta.status}`, detalhe: corpo.slice(0, 500) };
      }

      const json = (await resposta.json()) as {
        data: LinhaInsights[];
        paging?: { next?: string };
      };

      for (const linha of json.data) {
        if (!linha.ad_id) continue;
        const dia = new Date(linha.date_start + "T00:00:00Z");
        const acoes = mapaDeAcoes(linha.actions);
        const thruplays = mapaDeAcoes(linha.video_thruplay_watched_actions);
        // ThruPlay vem num campo à parte; guardado junto das ações com nome próprio.
        if (Object.keys(thruplays).length) {
          acoes.thruplay = Object.values(thruplays).reduce((a, b) => a + b, 0);
        }
        const resultados = {
          objetivo: linha.objective ?? null,
          otimizacao: linha.optimization_goal ?? null,
          cliquesLink: Number(linha.inline_link_clicks ?? 0),
          acoes,
          valoresAcoes: mapaDeAcoes(linha.action_values),
        };

        await prisma.gasto.upsert({
          where: { clienteId_adId_dia: { clienteId, adId: linha.ad_id, dia } },
          update: {
            valor: Number(linha.spend ?? 0),
            impressoes: Number(linha.impressions ?? 0),
            cliques: Number(linha.clicks ?? 0),
            adNome: linha.ad_name ?? null,
            adsetNome: linha.adset_name ?? null,
            campaignNome: linha.campaign_name ?? null,
            ...resultados,
          },
          create: {
            clienteId,
            adId: linha.ad_id,
            adsetId: linha.adset_id ?? null,
            campaignId: linha.campaign_id ?? null,
            adNome: linha.ad_name ?? null,
            adsetNome: linha.adset_name ?? null,
            campaignNome: linha.campaign_name ?? null,
            dia,
            valor: Number(linha.spend ?? 0),
            impressoes: Number(linha.impressions ?? 0),
            cliques: Number(linha.clicks ?? 0),
            ...resultados,
          },
        });
        gravados++;
      }

      url = json.paging?.next ?? null;
    }
  } catch (erro) {
    console.error("[meta/marketing] falha", erro);
    return { erro: "Falha ao falar com o Meta", detalhe: String(erro).slice(0, 300) };
  }

  return { gravados, de: dataISO(de), ate: dataISO(ate) };
}

/**
 * Pessoas alcançadas por campanha no período, direto do Meta.
 *
 * Alcance não se soma dia a dia: quem viu na segunda e na terça é uma pessoa
 * só. Por isso não sai da tabela de gasto; é pedido pronto ao Meta para o
 * período exato e guardado em cache por 6 horas. Sem token ou com o Meta fora,
 * volta vazio e a tela segue sem o número.
 */
export async function alcancePorCampanha(
  clienteId: string,
  de: string,
  ate: string,
): Promise<{ total: number | null; porCampanha: Map<string, { alcance: number; frequencia: number }> }> {
  const vazio = { total: null, porCampanha: new Map() };
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { contaAnunciosId: true, marketingToken: true },
  });
  let token: string | null = null;
  try {
    token = decifrar(cliente?.marketingToken);
  } catch {
    return vazio;
  }
  if (!cliente?.contaAnunciosId || !token) return vazio;
  const conta = cliente.contaAnunciosId.startsWith("act_")
    ? cliente.contaAnunciosId
    : `act_${cliente.contaAnunciosId}`;

  const pedir = async (nivel: "campaign" | "account") => {
    const params = new URLSearchParams({
      level: nivel,
      fields: nivel === "campaign" ? "campaign_id,reach,frequency" : "reach",
      time_range: JSON.stringify({ since: de, until: ate }),
      limit: "200",
      access_token: token!,
    });
    const r = await fetch(`https://graph.facebook.com/${VERSAO_API}/${conta}/insights?${params}`, {
      next: { revalidate: 6 * 60 * 60 },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return [];
    const json = (await r.json()) as {
      data: { campaign_id?: string; reach?: string; frequency?: string }[];
    };
    return json.data;
  };

  try {
    const [campanhas, contaToda] = await Promise.all([pedir("campaign"), pedir("account")]);
    const porCampanha = new Map<string, { alcance: number; frequencia: number }>();
    for (const c of campanhas) {
      if (c.campaign_id) {
        porCampanha.set(c.campaign_id, {
          alcance: Number(c.reach ?? 0),
          frequencia: Number(c.frequency ?? 0),
        });
      }
    }
    const total = contaToda[0]?.reach != null ? Number(contaToda[0].reach) : null;
    return { total, porCampanha };
  } catch (erro) {
    console.error("[meta/alcance] falha", String(erro).slice(0, 200));
    return vazio;
  }
}
