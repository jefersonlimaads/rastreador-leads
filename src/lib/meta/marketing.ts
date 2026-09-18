import "server-only";
import { prisma } from "../prisma";

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
};

function dataISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function sincronizarGastos(clienteId: string, dias = DIAS_REBUSCA) {
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return { erro: "Cliente não encontrado" };
  if (!cliente.contaAnunciosId || !cliente.marketingToken) {
    return { erro: "Cliente sem conta de anúncios ou token da API de Marketing" };
  }

  const ate = new Date();
  const de = new Date();
  de.setDate(de.getDate() - (dias - 1));

  const params = new URLSearchParams({
    level: "ad",
    fields: "ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks",
    time_increment: "1",
    time_range: JSON.stringify({ since: dataISO(de), until: dataISO(ate) }),
    limit: "500",
    access_token: cliente.marketingToken,
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

        await prisma.gasto.upsert({
          where: { clienteId_adId_dia: { clienteId, adId: linha.ad_id, dia } },
          update: {
            valor: Number(linha.spend ?? 0),
            impressoes: Number(linha.impressions ?? 0),
            cliques: Number(linha.clicks ?? 0),
            adNome: linha.ad_name ?? null,
            adsetNome: linha.adset_name ?? null,
            campaignNome: linha.campaign_name ?? null,
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
