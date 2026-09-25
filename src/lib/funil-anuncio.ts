import type { AnuncioPeriodo } from "./inteligencia";
import type { TipoResultado } from "./resultados";

/**
 * Onde o anúncio está perdendo gente.
 *
 * "Chegou lead ou não" é o fim da história e não diz o que fazer. O caminho
 * tem etapas, e cada uma quebra por um motivo diferente:
 *
 *   impressão → clique      criativo e público: a peça convence a clicar?
 *   clique → visita         o caminho: a página abre para quem clicou?
 *   visita → contato        a página: quem chegou pede orçamento?
 *   contato → venda         o atendimento: quem pediu vira cliente?
 *
 * Trocar criativo quando o problema é a página é queimar verba sem mexer no
 * gargalo. Por isso a leitura aponta a etapa, não só o resultado.
 *
 * As etapas mudam com o tipo de campanha: Click-to-WhatsApp não tem página, e
 * formulário instantâneo acontece dentro do Meta. Cada tipo mostra só as
 * etapas que existem nele.
 *
 * Funções puras, testadas sem banco.
 */

export type ChaveEtapa = "impressoes" | "cliques" | "visitas" | "pedidos" | "contatos" | "vendas";

export type EtapaFunil = {
  chave: ChaveEtapa;
  rotulo: string;
  valor: number;
  /** Conversão desde a etapa anterior. Null na primeira. */
  taxa: number | null;
  /** O que essa passagem mede, em uma linha. */
  mede: string;
  /** Faixa de referência para essa passagem, quando existe uma. */
  referencia: Faixa | null;
  estado: "bom" | "ok" | "ruim" | "sem_referencia" | "sem_volume";
};

export type DiagnosticoFunil = {
  etapas: EtapaFunil[];
  /** A etapa mais fraca em relação à própria referência. */
  gargalo: { chave: ChaveEtapa; titulo: string; motivo: string; acao: string } | null;
};

type Faixa = { ruim: number; bom: number };

/*
 * Faixas de referência.
 *
 * São ponto de partida, não lei: variam com nicho, ticket e público. O valor
 * está menos no número exato e mais na comparação entre as etapas — a pior
 * delas é onde mexer primeiro. Calibre com os seus dados quando houver
 * histórico suficiente.
 */
const CTR_PADRAO: Faixa = { ruim: 0.008, bom: 0.02 };
const CTR_POR_TIPO: Partial<Record<TipoResultado, Faixa>> = {
  conversas: { ruim: 0.01, bom: 0.025 },
  compras: { ruim: 0.006, bom: 0.015 },
  visualizacoes_video: { ruim: 0.004, bom: 0.012 },
  thruplays: { ruim: 0.004, bom: 0.012 },
};

/**
 * Clique que chega a abrir a página. Perda aqui é caminho, não conteúdo:
 * página lenta, redirecionamento, ou quem desistiu no carregamento.
 */
const CONEXAO: Faixa = { ruim: 0.55, bom: 0.8 };

/** Visita que vira pedido de contato. É a régua da página e da oferta. */
const PAGINA: Faixa = { ruim: 0.03, bom: 0.12 };

/** Contato que vira venda. Depende do atendimento, e é onde o cliente atua. */
const FECHAMENTO: Faixa = { ruim: 0.08, bom: 0.25 };

/** Volume mínimo para a taxa significar alguma coisa. */
const MINIMO = { impressoes: 500, cliques: 30, visitas: 20, pedidos: 10, contatos: 8 };

function avaliar(taxa: number | null, faixa: Faixa | null, temVolume: boolean): EtapaFunil["estado"] {
  if (faixa == null) return "sem_referencia";
  if (!temVolume) return "sem_volume";
  if (taxa == null) return "ruim";
  if (taxa >= faixa.bom) return "bom";
  if (taxa >= faixa.ruim) return "ok";
  return "ruim";
}

const razao = (a: number, b: number) => (b > 0 ? a / b : null);

/**
 * O funil de um anúncio. `paginaRastreada` diz se o script está no ar para
 * esse cliente: sem ele, visita sempre seria zero e a leitura acusaria uma
 * página que na verdade nunca foi medida.
 */
export function funilDoAnuncio(a: AnuncioPeriodo, paginaRastreada: boolean): DiagnosticoFunil {
  /* Campanha de WhatsApp e de formulário do Meta não passam por página: a
     conversa começa dentro da própria plataforma. */
  const temPagina =
    paginaRastreada && a.tipo !== "conversas" && a.tipo !== "leads_formulario";

  const etapas: EtapaFunil[] = [
    {
      chave: "impressoes",
      rotulo: "Impressões",
      valor: a.impressoes,
      taxa: null,
      mede: "Quanto a verba entregou",
      referencia: null,
      estado: "sem_referencia",
    },
    {
      chave: "cliques",
      rotulo: "Cliques no link",
      valor: a.cliquesLink,
      taxa: razao(a.cliquesLink, a.impressoes),
      mede: "O criativo convence a clicar",
      referencia: CTR_POR_TIPO[a.tipo] ?? CTR_PADRAO,
      estado: "sem_referencia",
    },
  ];

  if (temPagina) {
    etapas.push({
      chave: "visitas",
      rotulo: "Visitas na página",
      valor: a.visualizacoesPagina,
      taxa: razao(a.visualizacoesPagina, a.cliquesLink),
      mede: "A página abre para quem clicou",
      referencia: CONEXAO,
      estado: "sem_referencia",
    });
    etapas.push({
      chave: "pedidos",
      rotulo: "Pediram contato",
      valor: a.pedidosContato,
      taxa: razao(a.pedidosContato, a.visualizacoesPagina || a.cliquesLink),
      mede: "Quem abriu preenche o formulário ou chama no WhatsApp",
      referencia: PAGINA,
      estado: "sem_referencia",
    });
  }

  etapas.push({
    chave: "contatos",
    rotulo: "Contatos registrados",
    valor: a.contatosPainel,
    taxa: temPagina
      ? razao(a.contatosPainel, a.pedidosContato)
      : razao(a.contatosPainel, a.cliquesLink),
    /* Sem referência de propósito: pedido sem contato costuma ser confirmação
       pendente do cliente, não perda de verdade. */
    mede: temPagina ? "O pedido vira conversa registrada" : "O clique vira conversa",
    referencia: null,
    estado: "sem_referencia",
  });

  etapas.push({
    chave: "vendas",
    rotulo: "Vendas",
    valor: a.fechados,
    taxa: razao(a.fechados, a.contatosPainel),
    mede: "O atendimento fecha",
    referencia: FECHAMENTO,
    estado: "sem_referencia",
  });

  // Volume da etapa anterior: taxa sobre base pequena não sustenta diagnóstico.
  const volumes: Record<ChaveEtapa, number> = {
    impressoes: Infinity,
    cliques: a.impressoes >= MINIMO.impressoes ? Infinity : 0,
    visitas: a.cliquesLink >= MINIMO.cliques ? Infinity : 0,
    pedidos: (a.visualizacoesPagina || a.cliquesLink) >= MINIMO.visitas ? Infinity : 0,
    contatos: (temPagina ? a.pedidosContato : a.cliquesLink) >= MINIMO.pedidos ? Infinity : 0,
    vendas: a.contatosPainel >= MINIMO.contatos ? Infinity : 0,
  };
  for (const e of etapas) e.estado = avaliar(e.taxa, e.referencia, volumes[e.chave] > 0);

  return { etapas, gargalo: acharGargalo(etapas, temPagina) };
}

const TEXTOS: Record<ChaveEtapa, { titulo: string; motivo: string; acao: string }> = {
  impressoes: { titulo: "", motivo: "", acao: "" },
  cliques: {
    titulo: "O criativo não está fazendo clicar",
    motivo: "de cada mil pessoas que viram, poucas clicaram",
    acao: "O gargalo é a peça, não a página: troque o ângulo, a primeira frase ou a imagem. Mexer na página aqui não resolve.",
  },
  visitas: {
    titulo: "O clique não está virando visita",
    motivo: "boa parte de quem clicou não chegou a abrir a página",
    acao: "Isso é caminho, não conteúdo: confira a velocidade da página no celular e se há redirecionamento no meio. Trocar criativo aqui não resolve.",
  },
  pedidos: {
    titulo: "A página não está virando pedido",
    motivo: "de quem abriu a página, pouca gente preencheu o formulário ou chamou no WhatsApp",
    acao: "O criativo está entregando: o gargalo é a página. Oferta acima da dobra, formulário mais curto, prova social e botão de WhatsApp visível no celular. Se a página demorar a abrir, some gente antes de ler.",
  },
  contatos: {
    titulo: "Pedido sem conversa registrada",
    motivo: "houve pedido de contato que não virou conversa no painel",
    acao: "Em geral é confirmação pendente: mande o link de confirmação para o cliente dizer com quem falou.",
  },
  vendas: {
    titulo: "O contato não está virando venda",
    motivo: "o contato chega e não fecha",
    acao: "A mídia entregou; o gargalo é o atendimento. Veja tempo de resposta e o que está sendo respondido — leve isso para a conversa com o cliente.",
  },
};

/**
 * A etapa a resolver primeiro: a pior em relação à própria referência, e
 * sempre a mais no começo do caminho entre as ruins — arrumar a página não
 * adianta enquanto ninguém clica.
 */
function acharGargalo(etapas: EtapaFunil[], temPagina: boolean): DiagnosticoFunil["gargalo"] {
  const ruim = etapas.find((e) => e.estado === "ruim" && e.chave !== "impressoes");
  if (!ruim) return null;

  const texto = TEXTOS[ruim.chave];
  const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  const referencia = ruim.referencia;

  return {
    chave: ruim.chave,
    titulo: texto.titulo,
    motivo: `${texto.motivo}: ${ruim.taxa != null ? pct(ruim.taxa) : "0%"}${
      referencia ? `, contra ${pct(referencia.ruim)} de mínimo aceitável` : ""
    }.`,
    acao:
      ruim.chave === "contatos" && !temPagina
        ? "Poucos cliques viraram conversa. Confira a mensagem pré-preenchida do WhatsApp e se quem chama recebe resposta."
        : texto.acao,
  };
}
