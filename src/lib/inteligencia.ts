import type { TipoResultado } from "./resultados";
import { RESULTADO } from "./resultados";

/**
 * Leitura automática das campanhas: o que escalar, o que está cansado, o que
 * merece atenção e o que cortar.
 *
 * Tudo por regra, sobre os números que o Meta já entrega. Duas comparações
 * sustentam cada recomendação:
 *   1. o anúncio contra a média da conta no período (quem está caro ou barato);
 *   2. o anúncio contra ele mesmo no período anterior (quem está piorando).
 *
 * Nada aqui inventa: cada recomendação carrega os números que a geraram, para
 * você conferir antes de mexer na campanha. Funções puras, testadas sem banco.
 */

export type AnuncioPeriodo = {
  adId: string;
  nome: string;
  campanha: string | null;
  tipo: TipoResultado;
  gasto: number;
  impressoes: number;
  cliquesLink: number;
  resultados: number;
  /** Contatos que a plataforma viu chegar deste anúncio (página rastreada). */
  contatosPainel: number;
  fechados: number;
  receita: number;
};

export type Recomendacao = {
  adId: string;
  nome: string;
  campanha: string | null;
  categoria: "escalar" | "cansado" | "cortar" | "atencao" | "sem_dados" | "vendendo";
  titulo: string;
  motivo: string;
  numeros: { rotulo: string; valor: string }[];
  acao: string;
  /** Quanto essa recomendação importa: ordena a lista. */
  peso: number;
};

export type AlertaCampanha = {
  campanha: string;
  titulo: string;
  motivo: string;
  acao: string;
};

/* Limites das regras, num lugar só. Números redondos de operação de tráfego:
 * "metade do custo médio" é barato de verdade, "o dobro" é caro de verdade. */
const MIN_RESULTADOS_ESCALAR = 5;
const BARATO = 0.75; // custo por resultado até 75% da média da conta
const CARO = 1.4;
const MUITO_CARO = 1.8;
const QUEDA_CTR = 0.25; // queda de 25% no clique por impressão
const ALTA_CUSTO = 0.25;
const IMPRESSOES_PARA_CANSAR = 5000;
const CONCENTRACAO = 0.7; // um anúncio com 70% do gasto da campanha

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = (v: number) => v.toLocaleString("pt-BR");
const pct = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;

/** Tipos cujo custo se lê por mil, como no Gerenciador (CPM). */
const POR_MIL = new Set<TipoResultado>(["alcance", "impressoes"]);

/** Tipos em que a página deveria registrar o contato: só aí cabe comparar com o painel. */
const RASTREAVEIS = new Set<TipoResultado>(["leads_site", "leads_formulario", "visualizacoes_pagina"]);

const custoPor = (a: AnuncioPeriodo) =>
  a.resultados > 0 ? (a.gasto / a.resultados) * (POR_MIL.has(a.tipo) ? 1000 : 1) : null;
const ctr = (a: AnuncioPeriodo) => (a.impressoes > 0 ? a.cliquesLink / a.impressoes : null);
const variacao = (agora: number | null, antes: number | null) =>
  agora != null && antes != null && antes > 0 ? (agora - antes) / antes : null;

/**
 * Mediana do custo por resultado — sempre dentro do mesmo tipo de resultado.
 * Comparar conversa com impressão não diz nada: um custa centavos, a outra
 * custa reais. Sem pelo menos dois anúncios do mesmo tipo, não há média de
 * conta que sirva de régua, e as regras de "caro/barato" ficam de fora.
 */
export function custoMedio(anuncios: AnuncioPeriodo[], tipo?: TipoResultado): number | null {
  const doTipo = tipo ? anuncios.filter((a) => a.tipo === tipo) : anuncios;
  const custos = doTipo.map(custoPor).filter((c): c is number => c != null && c > 0).sort((a, b) => a - b);
  if (custos.length < (tipo ? 2 : 1)) return null;
  const meio = Math.floor(custos.length / 2);
  return custos.length % 2 ? custos[meio] : (custos[meio - 1] + custos[meio]) / 2;
}

/** Uma régua por tipo de resultado, e o tipo que mais consome orçamento. */
function reguas(anuncios: AnuncioPeriodo[]) {
  const tipos = new Set(anuncios.map((a) => a.tipo));
  const medianas = new Map<TipoResultado, number>();
  for (const t of tipos) {
    const m = custoMedio(anuncios, t);
    if (m != null) medianas.set(t, m);
  }
  const gastoPorTipo = new Map<TipoResultado, number>();
  for (const a of anuncios) gastoPorTipo.set(a.tipo, (gastoPorTipo.get(a.tipo) ?? 0) + a.gasto);
  const principal = [...gastoPorTipo.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
  return { medianas, principal };
}

export function recomendar(
  atual: AnuncioPeriodo[],
  anterior: AnuncioPeriodo[],
): {
  recomendacoes: Recomendacao[];
  alertas: AlertaCampanha[];
  custoMediano: number | null;
  tipoMediano: TipoResultado | null;
} {
  const antes = new Map(anterior.map((a) => [a.adId, a]));
  const { medianas, principal } = reguas(atual);
  const recomendacoes: Recomendacao[] = [];

  for (const a of atual) {
    if (a.gasto <= 0) continue;
    // A régua é a dos anúncios do mesmo tipo de resultado.
    const mediana = medianas.get(a.tipo) ?? null;
    const anteriorA = antes.get(a.adId) ?? null;
    const custo = custoPor(a);
    const custoAntes = anteriorA ? custoPor(anteriorA) : null;
    const variacaoCusto = variacao(custo, custoAntes);
    const variacaoCtr = variacao(ctr(a), anteriorA ? ctr(anteriorA) : null);
    const rotulo = RESULTADO[a.tipo];
    const numeros = [
      { rotulo: "Investido", valor: moeda(a.gasto) },
      { rotulo: rotulo.plural.replace(/^./, (l) => l.toUpperCase()), valor: inteiro(a.resultados) },
      { rotulo: `Custo ${rotulo.custo}`, valor: custo != null ? moeda(custo) : "—" },
      ...(variacaoCusto != null ? [{ rotulo: "Custo vs período anterior", valor: pct(variacaoCusto) }] : []),
      ...(variacaoCtr != null ? [{ rotulo: "Cliques por impressão", valor: pct(variacaoCtr) }] : []),
    ];

    // Vendeu de verdade: entra como reforço em qualquer diagnóstico, porque
    // anúncio que vende também pode estar cansado ou caro.
    const vendeu = a.receita > 0;
    if (vendeu) numeros.push({ rotulo: "Receita", valor: moeda(a.receita) });
    const reforco = vendeu
      ? ` Já trouxe ${a.fechados} ${a.fechados === 1 ? "venda fechada" : "vendas fechadas"} (${moeda(a.receita)}).`
      : "";
    const empurrao = vendeu ? 30 : 0;

    // 2. Cansado: entregando muito, sendo clicado menos e custando mais.
    const cansou =
      a.impressoes >= IMPRESSOES_PARA_CANSAR &&
      variacaoCtr != null &&
      variacaoCtr <= -QUEDA_CTR &&
      (variacaoCusto == null || variacaoCusto >= ALTA_CUSTO);
    if (cansou) {
      recomendacoes.push({
        adId: a.adId,
        nome: a.nome,
        campanha: a.campanha,
        categoria: "cansado",
        titulo: "Criativo cansado",
        motivo: `Com ${inteiro(a.impressoes)} impressões, o clique por impressão caiu ${pct(variacaoCtr!)}${
          variacaoCusto != null ? ` e o custo subiu ${pct(variacaoCusto)}` : ""
        }. É o desenho clássico de anúncio que a audiência já viu demais.${reforco}`,
        numeros,
        acao: vendeu
          ? "Vale um criativo novo com o mesmo ângulo: a oferta funciona, o que cansou foi a peça."
          : "Troque o criativo ou mude o ângulo da mensagem. Se o público for pequeno, amplie antes de trocar.",
        peso: 80 + a.gasto + empurrao,
      });
      continue;
    }

    // 3. Gastou o suficiente para ter resultado e não teve.
    if (a.resultados === 0 && mediana != null && a.gasto >= 2.5 * mediana) {
      recomendacoes.push({
        adId: a.adId,
        nome: a.nome,
        campanha: a.campanha,
        categoria: "cortar",
        titulo: "Gastando sem resultado",
        motivo: `${moeda(a.gasto)} investidos e nenhum resultado, com o custo médio da conta em ${moeda(mediana)}.${reforco}`,
        numeros,
        acao: "Pause e coloque o orçamento no que está funcionando.",
        peso: 90 + a.gasto,
      });
      continue;
    }

    if (custo != null && mediana != null) {
      // 4. Muito mais caro que a média da conta.
      if (custo >= MUITO_CARO * mediana && a.resultados >= 3) {
        recomendacoes.push({
          adId: a.adId,
          nome: a.nome,
          campanha: a.campanha,
          categoria: "cortar",
          titulo: "Muito mais caro que a média",
          motivo: `${moeda(custo)} ${rotulo.custo} contra ${moeda(mediana)} da conta: quase o dobro.${reforco}`,
          numeros,
          acao: vendeu
            ? "Caro na mídia, mas está vendendo: compare o custo por venda antes de cortar."
            : "Pause ou reduza o orçamento e observe se o custo da conta melhora.",
          peso: 70 + a.gasto,
        });
        continue;
      }

      // 5. Barato e com volume: dá para investir mais.
      if (custo <= BARATO * mediana && a.resultados >= MIN_RESULTADOS_ESCALAR) {
        const piorando = variacaoCusto != null && variacaoCusto > ALTA_CUSTO;
        recomendacoes.push({
          adId: a.adId,
          nome: a.nome,
          campanha: a.campanha,
          categoria: piorando ? "atencao" : "escalar",
          titulo: piorando ? "Barato, mas piorando" : "Pronto para escalar",
          motivo: piorando
            ? `Ainda abaixo da média (${moeda(custo)} contra ${moeda(mediana)}), mas o custo subiu ${pct(variacaoCusto!)} em relação ao período anterior.`
            : `${moeda(custo)} ${rotulo.custo} contra ${moeda(mediana)} da conta, com ${inteiro(a.resultados)} ${rotulo.plural}.${reforco}`,
          numeros,
          acao: piorando
            ? "Acompanhe por mais alguns dias antes de aumentar o orçamento."
            : "Aumente o orçamento em 20% a 30% e confira de novo em 3 dias. Subir demais de uma vez reinicia o aprendizado.",
          peso: (piorando ? 60 : 95) + a.resultados + empurrao,
        });
        continue;
      }

      // 6. Caro, mas ainda não é caso de corte.
      if (custo >= CARO * mediana) {
        recomendacoes.push({
          adId: a.adId,
          nome: a.nome,
          campanha: a.campanha,
          categoria: "atencao",
          titulo: "Acima do custo médio",
          motivo: `${moeda(custo)} ${rotulo.custo} contra ${moeda(mediana)} da conta.${reforco}`,
          numeros,
          acao: "Observe mais alguns dias. Se não melhorar, reduza o orçamento.",
          peso: 50 + a.gasto + empurrao,
        });
        continue;
      }
    }

    // 7. Vendeu e não caiu em nenhum caso acima: está saudável.
    if (vendeu) {
      recomendacoes.push({
        adId: a.adId,
        nome: a.nome,
        campanha: a.campanha,
        categoria: "vendendo",
        titulo: "Trouxe venda fechada",
        motivo: `${a.fechados} ${a.fechados === 1 ? "venda fechada" : "vendas fechadas"}, ${moeda(a.receita)} de receita, com ${moeda(a.gasto)} investidos.`,
        numeros,
        acao: "Mantenha no ar e use o criativo como base para as próximas variações.",
        peso: 85 + Math.min(a.receita / 100, 50),
      });
      continue;
    }

    // 8. Pouco investido para concluir qualquer coisa.
    if (mediana != null && a.gasto < mediana && a.resultados === 0) {
      recomendacoes.push({
        adId: a.adId,
        nome: a.nome,
        campanha: a.campanha,
        categoria: "sem_dados",
        titulo: "Ainda sem dados",
        motivo: `${moeda(a.gasto)} investidos, abaixo do custo médio de um resultado (${moeda(mediana)}). Ainda não dá para concluir nada.`,
        numeros,
        acao: "Deixe rodar até gastar pelo menos o custo de um resultado antes de decidir.",
        peso: 10,
      });
    }
  }

  return {
    recomendacoes: recomendacoes.sort((a, b) => b.peso - a.peso),
    alertas: alertasDeCampanha(atual, anterior),
    // Para a tela: a régua do tipo de resultado que mais consome orçamento.
    custoMediano: principal ? (medianas.get(principal) ?? null) : null,
    tipoMediano: principal,
  };
}

function porCampanha(anuncios: AnuncioPeriodo[]) {
  const mapa = new Map<string, AnuncioPeriodo[]>();
  for (const a of anuncios) {
    const chave = a.campanha ?? "Sem campanha";
    mapa.set(chave, [...(mapa.get(chave) ?? []), a]);
  }
  return mapa;
}

function alertasDeCampanha(atual: AnuncioPeriodo[], anterior: AnuncioPeriodo[]): AlertaCampanha[] {
  const alertas: AlertaCampanha[] = [];
  const antes = porCampanha(anterior);

  for (const [campanha, anuncios] of porCampanha(atual)) {
    const gasto = anuncios.reduce((s, a) => s + a.gasto, 0);
    const resultados = anuncios.reduce((s, a) => s + a.resultados, 0);
    if (gasto <= 0) continue;
    const custo = resultados > 0 ? gasto / resultados : null;

    const anterioresDaCampanha = antes.get(campanha) ?? [];
    const gastoAntes = anterioresDaCampanha.reduce((s, a) => s + a.gasto, 0);
    const resultadosAntes = anterioresDaCampanha.reduce((s, a) => s + a.resultados, 0);
    const custoAntes = resultadosAntes > 0 ? gastoAntes / resultadosAntes : null;
    const variacaoCusto = variacao(custo, custoAntes);

    if (variacaoCusto != null && variacaoCusto >= 0.3) {
      alertas.push({
        campanha,
        titulo: "Custo por resultado subindo",
        motivo: `${moeda(custo!)} agora contra ${moeda(custoAntes!)} no período anterior (${pct(variacaoCusto)}).`,
        acao: "Veja quais anúncios puxaram o custo para cima e troque os cansados.",
      });
    }

    if (resultados === 0 && gasto > 0) {
      alertas.push({
        campanha,
        titulo: "Campanha sem resultado no período",
        motivo: `${moeda(gasto)} investidos e nenhum resultado registrado.`,
        acao: "Confira se a campanha está medindo o resultado certo e se o anúncio leva ao lugar certo.",
      });
    }

    // Um anúncio levando quase todo o orçamento: se ele cansar, a campanha cai junto.
    const maior = [...anuncios].sort((a, b) => b.gasto - a.gasto)[0];
    if (anuncios.length >= 3 && maior.gasto / gasto >= CONCENTRACAO) {
      alertas.push({
        campanha,
        titulo: "Orçamento concentrado num anúncio só",
        motivo: `"${maior.nome}" ficou com ${Math.round((maior.gasto / gasto) * 100)}% do investimento da campanha.`,
        acao: "Tenha pelo menos um segundo criativo rodando: quando esse cansar, a campanha inteira sente.",
      });
    }

    // O Meta conta de um jeito, a página registra de outro: divergência grande
    // pede conferência — mas só onde a página deveria mesmo registrar contato.
    const rastreaveis = anuncios.filter((a) => RASTREAVEIS.has(a.tipo));
    const doMeta = rastreaveis.reduce((s, a) => s + a.resultados, 0);
    const doPainel = rastreaveis.reduce((s, a) => s + a.contatosPainel, 0);
    if (doPainel > 0 && doMeta > 0 && doPainel <= doMeta * 0.5) {
      alertas.push({
        campanha,
        titulo: "Meta conta mais do que chega na página",
        motivo: `${inteiro(doMeta)} resultados pelo Meta contra ${inteiro(doPainel)} contatos registrados pela página.`,
        acao: "Confira se o script está em todas as páginas e se os anúncios usam os parâmetros de URL.",
      });
    }
  }

  return alertas;
}
