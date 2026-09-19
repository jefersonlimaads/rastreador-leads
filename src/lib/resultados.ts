/**
 * Resultado de campanha, do jeito que o Gerenciador de Anúncios chama.
 *
 * Cada tipo de campanha tem "o seu" número: clique para WhatsApp conta
 * conversas iniciadas, formulário conta leads, alcance conta pessoas, vídeo
 * conta ThruPlays. Quem decide é a otimização do conjunto (a mesma coluna
 * "Resultados" do Gerenciador); o objetivo da campanha só desempata.
 *
 * Funções puras: recebem as linhas de gasto e devolvem números. Sem banco.
 */

export type TipoResultado =
  | "conversas"
  | "leads_formulario"
  | "leads_site"
  | "compras"
  | "cadastros"
  | "visualizacoes_pagina"
  | "cliques_link"
  | "alcance"
  | "impressoes"
  | "thruplays"
  | "visualizacoes_video"
  | "engajamentos";

export const RESULTADO: Record<TipoResultado, { plural: string; singular: string; custo: string }> = {
  conversas: { plural: "conversas iniciadas", singular: "conversa iniciada", custo: "por conversa" },
  leads_formulario: { plural: "leads no formulário", singular: "lead no formulário", custo: "por lead" },
  leads_site: { plural: "leads no site", singular: "lead no site", custo: "por lead" },
  compras: { plural: "compras", singular: "compra", custo: "por compra" },
  cadastros: { plural: "cadastros", singular: "cadastro", custo: "por cadastro" },
  visualizacoes_pagina: { plural: "visitas à página", singular: "visita à página", custo: "por visita" },
  cliques_link: { plural: "cliques no link", singular: "clique no link", custo: "por clique" },
  alcance: { plural: "pessoas alcançadas", singular: "pessoa alcançada", custo: "a cada mil pessoas" },
  impressoes: { plural: "impressões", singular: "impressão", custo: "a cada mil impressões" },
  thruplays: { plural: "ThruPlays", singular: "ThruPlay", custo: "por ThruPlay" },
  visualizacoes_video: { plural: "visualizações de vídeo", singular: "visualização de vídeo", custo: "por visualização" },
  engajamentos: { plural: "engajamentos", singular: "engajamento", custo: "por engajamento" },
};

/** Nome do objetivo da campanha como aparece no Gerenciador. */
export const ROTULO_OBJETIVO: Record<string, string> = {
  OUTCOME_LEADS: "Cadastros",
  OUTCOME_SALES: "Vendas",
  OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_AWARENESS: "Reconhecimento",
  OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_APP_PROMOTION: "Promoção do app",
  // Objetivos antigos, de campanhas criadas antes da mudança do Meta.
  MESSAGES: "Mensagens",
  LEAD_GENERATION: "Geração de cadastros",
  CONVERSIONS: "Conversões",
  LINK_CLICKS: "Tráfego",
  REACH: "Alcance",
  BRAND_AWARENESS: "Reconhecimento",
  VIDEO_VIEWS: "Visualizações do vídeo",
  POST_ENGAGEMENT: "Engajamento",
};

export type Acoes = Record<string, number>;

const CONVERSA = [
  "onsite_conversion.messaging_conversation_started_7d",
  "messaging_conversation_started_7d",
];
const LEAD_FORMULARIO = ["onsite_conversion.lead_grouped", "leadgen_grouped"];
const LEAD_SITE = ["offsite_conversion.fb_pixel_lead"];
const COMPRA = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];
const CADASTRO = ["omni_complete_registration", "complete_registration", "offsite_conversion.fb_pixel_complete_registration"];

/** Primeiro tipo da lista que o Meta mandou: são sinônimos, somar contaria duas vezes. */
export function contar(acoes: Acoes | null | undefined, tipos: string[]): number {
  if (!acoes) return 0;
  for (const t of tipos) if (acoes[t] != null) return acoes[t];
  return 0;
}

export function conversas(acoes: Acoes | null | undefined) {
  return contar(acoes, CONVERSA);
}

/** Leads que o Meta registrou: formulário instantâneo ou evento Lead do pixel. */
export function leadsMeta(acoes: Acoes | null | undefined) {
  if (!acoes) return 0;
  // "lead" é o total que o Meta já soma; sem ele, soma as duas origens.
  if (acoes.lead != null) return acoes.lead;
  return contar(acoes, LEAD_FORMULARIO) + contar(acoes, LEAD_SITE);
}

type Linha = {
  otimizacao: string | null;
  objetivo: string | null;
  acoes: Acoes | null;
  cliquesLink: number;
  impressoes: number;
};

/** Qual resultado a otimização do conjunto persegue. */
export function tipoDoResultado(otimizacao: string | null, objetivo: string | null, acoes?: Acoes | null): TipoResultado {
  switch (otimizacao) {
    case "CONVERSATIONS":
      return "conversas";
    case "LEAD_GENERATION":
    case "QUALITY_LEAD":
      return "leads_formulario";
    case "LANDING_PAGE_VIEWS":
      return "visualizacoes_pagina";
    case "LINK_CLICKS":
      return "cliques_link";
    case "REACH":
      return "alcance";
    case "IMPRESSIONS":
    case "AD_RECALL_LIFT":
      return "impressoes";
    case "THRUPLAY":
      return "thruplays";
    case "TWO_SECOND_CONTINUOUS_VIDEO_VIEWS":
      return "visualizacoes_video";
    case "POST_ENGAGEMENT":
    case "ENGAGED_USERS":
      return "engajamentos";
    case "VALUE":
      return "compras";
    case "OFFSITE_CONVERSIONS":
      // Conversão no site: o evento que tiver acontecido diz qual era.
      if (contar(acoes, COMPRA) > 0 || objetivo === "OUTCOME_SALES") return "compras";
      if (contar(acoes, CADASTRO) > 0 && contar(acoes, LEAD_SITE) === 0) return "cadastros";
      return "leads_site";
  }
  // Sem otimização conhecida: o objetivo decide, e o que aconteceu desempata.
  if (conversas(acoes) > 0) return "conversas";
  if (objetivo === "OUTCOME_SALES") return "compras";
  if (objetivo === "OUTCOME_LEADS" || objetivo === "LEAD_GENERATION") return "leads_formulario";
  if (objetivo === "OUTCOME_AWARENESS" || objetivo === "REACH") return "alcance";
  if (objetivo === "VIDEO_VIEWS") return "thruplays";
  if (objetivo === "OUTCOME_ENGAGEMENT" || objetivo === "POST_ENGAGEMENT") return "engajamentos";
  return "cliques_link";
}

/** Quantos resultados daquele tipo a linha teve. Alcance não soma: fica 0 aqui. */
export function quantidade(tipo: TipoResultado, l: Linha): number {
  const a = l.acoes;
  switch (tipo) {
    case "conversas":
      return conversas(a);
    case "leads_formulario":
      return contar(a, LEAD_FORMULARIO) || leadsMeta(a);
    case "leads_site":
      return contar(a, LEAD_SITE) || leadsMeta(a);
    case "compras":
      return contar(a, COMPRA);
    case "cadastros":
      return contar(a, CADASTRO);
    case "visualizacoes_pagina":
      return contar(a, ["landing_page_view", "omni_landing_page_view"]);
    case "cliques_link":
      return l.cliquesLink || contar(a, ["link_click"]);
    case "alcance":
      return 0;
    case "impressoes":
      return l.impressoes;
    case "thruplays":
      return contar(a, ["thruplay"]);
    case "visualizacoes_video":
      return contar(a, ["video_view"]);
    case "engajamentos":
      return contar(a, ["post_engagement", "page_engagement"]);
  }
}

export type LinhaGasto = Linha & {
  campaignId: string | null;
  campaignNome: string | null;
  valor: number;
  valoresAcoes: Acoes | null;
};

export type ResultadoCampanha = {
  campaignId: string;
  nome: string;
  objetivo: string | null;
  tipo: TipoResultado;
  resultados: number;
  gasto: number;
  custoPorResultado: number | null;
  impressoes: number;
  cliquesLink: number;
  conversas: number;
  leadsMeta: number;
  compras: number;
  valorCompras: number;
  alcance: number | null;
  frequencia: number | null;
};

/**
 * Soma as linhas diárias por campanha. Campanha com conjuntos de otimizações
 * diferentes fica com a do conjunto que mais gastou, como o Gerenciador mostra.
 */
export function resultadosPorCampanha(
  linhas: LinhaGasto[],
  alcance?: Map<string, { alcance: number; frequencia: number }>,
): ResultadoCampanha[] {
  const grupos = new Map<string, LinhaGasto[]>();
  for (const l of linhas) {
    const chave = l.campaignId ?? "sem-campanha";
    grupos.set(chave, [...(grupos.get(chave) ?? []), l]);
  }

  const saida: ResultadoCampanha[] = [];
  for (const [campaignId, doGrupo] of grupos) {
    // Linhas gravadas antes de o sistema buscar resultados não dizem nada sobre
    // eles: a campanha volta aqui na próxima sincronização.
    if (doGrupo.every((l) => !l.otimizacao && !l.objetivo && !l.acoes)) continue;
    const gastoPorOtimizacao = new Map<string, number>();
    for (const l of doGrupo) {
      const k = `${l.otimizacao ?? ""}|${l.objetivo ?? ""}`;
      gastoPorOtimizacao.set(k, (gastoPorOtimizacao.get(k) ?? 0) + l.valor);
    }
    const [otimizacao, objetivo] = [...gastoPorOtimizacao.entries()]
      .sort((a, b) => b[1] - a[1])[0][0]
      .split("|")
      .map((x) => x || null);
    const todasAcoes: Acoes = {};
    for (const l of doGrupo) {
      for (const [k, v] of Object.entries(l.acoes ?? {})) todasAcoes[k] = (todasAcoes[k] ?? 0) + v;
    }
    const doAlcance = alcance?.get(campaignId) ?? null;
    // Sem o alcance do Meta (token fora, período sem dados), mostra impressões.
    let tipo = tipoDoResultado(otimizacao, objetivo, todasAcoes);
    if (tipo === "alcance" && !doAlcance) tipo = "impressoes";

    const soma = (f: (l: LinhaGasto) => number) => doGrupo.reduce((s, l) => s + f(l), 0);
    const gasto = soma((l) => l.valor);
    const impressoes = soma((l) => l.impressoes);
    const resultados = tipo === "alcance" ? (doAlcance?.alcance ?? 0) : soma((l) => quantidade(tipo, l));
    const porMil = tipo === "alcance" || tipo === "impressoes";

    saida.push({
      campaignId,
      nome: doGrupo.find((l) => l.campaignNome)?.campaignNome ?? campaignId,
      objetivo,
      tipo,
      resultados,
      gasto,
      custoPorResultado: resultados > 0 && gasto > 0 ? (porMil ? (gasto / resultados) * 1000 : gasto / resultados) : null,
      impressoes,
      cliquesLink: soma((l) => l.cliquesLink),
      conversas: soma((l) => conversas(l.acoes)),
      leadsMeta: soma((l) => leadsMeta(l.acoes)),
      compras: soma((l) => contar(l.acoes, COMPRA)),
      valorCompras: soma((l) => contar(l.valoresAcoes, COMPRA)),
      alcance: doAlcance?.alcance ?? null,
      frequencia: doAlcance?.frequencia ?? null,
    });
  }
  return saida.sort((a, b) => b.gasto - a.gasto);
}
