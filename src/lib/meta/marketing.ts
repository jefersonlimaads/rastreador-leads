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
  outbound_clicks?: { action_type: string; value: string }[];
  reach?: string;
  frequency?: string;
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
  "outbound_clicks",
  "reach",
  "frequency",
  "actions",
  "action_values",
  "video_thruplay_watched_actions",
].join(",");

function dataISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** "123" ou "act_123" → "act_123". */
export function formatoConta(conta: string) {
  return conta.startsWith("act_") ? conta : `act_${conta}`;
}

/**
 * Token e contas de um cliente. O token próprio do cliente, se houver, vale
 * mais que o da agência — é o caso raro da conta que não pode ser compartilhada
 * com a BM da agência. O token decifrado nunca sai deste arquivo.
 */
async function credenciaisMeta(clienteId: string) {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: {
      marketingToken: true,
      agencia: { select: { metaToken: true } },
      contas: { select: { contaId: true }, orderBy: { criadoEm: "asc" } },
    },
  });
  if (!cliente) return null;
  let token: string | null = null;
  try {
    token = decifrar(cliente.marketingToken) ?? decifrar(cliente.agencia.metaToken);
  } catch {
    token = null;
  }
  return { token, contas: cliente.contas.map((c) => formatoConta(c.contaId)) };
}

export async function sincronizarGastos(clienteId: string, dias = DIAS_REBUSCA) {
  const cred = await credenciaisMeta(clienteId);
  if (!cred) return { erro: "Cliente não encontrado" };
  if (!cred.token) return { erro: "Meta não conectado: cadastre o token da agência em Ajustes" };
  if (cred.contas.length === 0) return { erro: "Cliente sem conta de anúncios" };

  const ate = new Date();
  const de = new Date();
  de.setDate(de.getDate() - (dias - 1));

  let gravados = 0;
  const falhas: { conta: string; erro: string; detalhe?: string }[] = [];
  for (const conta of cred.contas) {
    const r = await sincronizarConta(clienteId, conta, cred.token, de, ate);
    if ("erro" in r) falhas.push({ conta, ...r });
    else gravados += r.gravados;
  }

  // Todas falharam: devolve o erro da primeira, que é o que a tela mostra.
  if (falhas.length === cred.contas.length) {
    return { erro: `${falhas[0].conta}: ${falhas[0].erro}`, detalhe: falhas[0].detalhe };
  }
  return { gravados, de: dataISO(de), ate: dataISO(ate), contas: cred.contas.length, falhas };
}

/**
 * anúncio → criativo. O mesmo criativo roda em vários anúncios e campanhas, e
 * é por ele que se compara peça com peça. O insights não traz esse campo, daí
 * a chamada à parte.
 */
async function criativosDaConta(conta: string, token: string): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const params = new URLSearchParams({
    fields: "id,creative{id}",
    limit: "500",
    access_token: token,
  });
  let url: string | null = `https://graph.facebook.com/${VERSAO_API}/${conta}/ads?${params}`;

  try {
    while (url) {
      const r = await fetch(url);
      if (!r.ok) return mapa;
      const json = (await r.json()) as {
        data: { id: string; creative?: { id?: string } }[];
        paging?: { next?: string };
      };
      for (const a of json.data) if (a.creative?.id) mapa.set(a.id, a.creative.id);
      url = json.paging?.next ?? null;
    }
  } catch {
    // Sem criativo o painel funciona; sem gasto, não. Segue sem.
  }
  return mapa;
}

async function sincronizarConta(
  clienteId: string,
  conta: string,
  token: string,
  de: Date,
  ate: Date,
): Promise<{ gravados: number } | { erro: string; detalhe?: string }> {
  const params = new URLSearchParams({
    level: "ad",
    fields: CAMPOS,
    time_increment: "1",
    time_range: JSON.stringify({ since: dataISO(de), until: dataISO(ate) }),
    limit: "500",
    access_token: token,
  });

  /* O insights não devolve o criativo, então o mapa vem da lista de anúncios.
     Falhar aqui não derruba a sincronização: sem criativo, o resto continua. */
  const criativos = await criativosDaConta(conta, token);

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
        const saida = mapaDeAcoes(linha.outbound_clicks);
        const resultados = {
          objetivo: linha.objective ?? null,
          otimizacao: linha.optimization_goal ?? null,
          cliquesLink: Number(linha.inline_link_clicks ?? 0),
          cliquesSaida: saida.outbound_click ?? Object.values(saida).reduce((a, b) => a + b, 0),
          // Também fica em acoes; a coluna existe para somar e ordenar barato.
          visualizacoesPagina: acoes.landing_page_view ?? acoes.omni_landing_page_view ?? 0,
          alcanceDia: Number(linha.reach ?? 0),
          frequencia: linha.frequency ? Number(linha.frequency) : null,
          creativeId: criativos.get(linha.ad_id) ?? null,
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

  return { gravados };
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
  const cred = await credenciaisMeta(clienteId);
  if (!cred?.token || cred.contas.length === 0) return vazio;
  const token = cred.token;

  const pedir = async (conta: string, nivel: "campaign" | "account") => {
    const params = new URLSearchParams({
      level: nivel,
      fields: nivel === "campaign" ? "campaign_id,reach,frequency" : "reach",
      time_range: JSON.stringify({ since: de, until: ate }),
      limit: "200",
      access_token: token,
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
    const porCampanha = new Map<string, { alcance: number; frequencia: number }>();
    let total: number | null = null;
    const respostas = await Promise.all(
      cred.contas.map(async (conta) => ({
        campanhas: await pedir(conta, "campaign"),
        contaToda: await pedir(conta, "account"),
      })),
    );
    for (const { campanhas, contaToda } of respostas) {
      for (const c of campanhas) {
        if (c.campaign_id) {
          porCampanha.set(c.campaign_id, {
            alcance: Number(c.reach ?? 0),
            frequencia: Number(c.frequency ?? 0),
          });
        }
      }
      if (contaToda[0]?.reach != null) total = Number(contaToda[0].reach);
    }
    // Pessoas de contas diferentes se repetem: com mais de uma conta, o total
    // único não existe pronto no Meta, e somar enganaria. Fica sem o número.
    return { total: cred.contas.length === 1 ? total : null, porCampanha };
  } catch (erro) {
    console.error("[meta/alcance] falha", String(erro).slice(0, 200));
    return vazio;
  }
}

export type ContaDisponivel = { contaId: string; nome: string; negocio: string | null; ativa: boolean };

/**
 * Contas de anúncios que o token da agência enxerga: as da própria BM e as
 * compartilhadas pelos clientes (como parceira) e atribuídas ao usuário do
 * sistema. É a lista de onde se escolhe a conta de cada cliente.
 */
export async function contasDisponiveis(
  agenciaId: string,
): Promise<{ contas: ContaDisponivel[]; erro?: string }> {
  const agencia = await prisma.agencia.findUnique({ where: { id: agenciaId }, select: { metaToken: true } });
  let token: string | null = null;
  try {
    token = decifrar(agencia?.metaToken);
  } catch {
    return { contas: [], erro: "Token da agência ilegível: cadastre de novo" };
  }
  if (!token) return { contas: [], erro: "Meta não conectado" };
  return listarContas(token);
}

async function listarContas(token: string): Promise<{ contas: ContaDisponivel[]; erro?: string }> {
  const params = new URLSearchParams({
    fields: "name,account_id,account_status,business{name}",
    limit: "200",
    access_token: token,
  });
  try {
    const r = await fetch(`https://graph.facebook.com/${VERSAO_API}/me/adaccounts?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const json = (await r.json()) as {
      data?: { name: string; account_id: string; account_status: number; business?: { name: string } }[];
      error?: { message: string };
    };
    if (!r.ok || !json.data) return { contas: [], erro: json.error?.message ?? `Meta respondeu ${r.status}` };
    return {
      contas: json.data
        .map((c) => ({
          contaId: `act_${c.account_id}`,
          nome: c.name,
          negocio: c.business?.name ?? null,
          // 1 = ativa; os outros estados são desativada, em análise, com pendência.
          ativa: c.account_status === 1,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    };
  } catch (erro) {
    return { contas: [], erro: `Falha ao falar com o Meta: ${String(erro).slice(0, 120)}` };
  }
}

/** Confere um token antes de guardar: quem é e quantas contas enxerga. */
export async function testarToken(token: string) {
  try {
    const r = await fetch(
      `https://graph.facebook.com/${VERSAO_API}/me?fields=name&access_token=${encodeURIComponent(token)}`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) },
    );
    const json = (await r.json()) as { name?: string; error?: { message: string } };
    if (!r.ok) return { erro: json.error?.message ?? `Meta respondeu ${r.status}` };
    const { contas, erro } = await listarContas(token);
    if (erro) return { erro };
    return { nome: json.name ?? "usuário do sistema", contas: contas.length };
  } catch (erro) {
    return { erro: `Falha ao falar com o Meta: ${String(erro).slice(0, 120)}` };
  }
}
