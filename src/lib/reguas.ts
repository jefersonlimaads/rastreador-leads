/**
 * As réguas do diagnóstico: o que conta como bom, regular ou ruim em cada
 * passagem do funil.
 *
 * Os números aqui são ponto de partida de mercado, não lei — variam com nicho,
 * ticket e público. São o último recurso quando ninguém configurou nada, e é
 * de propósito que existam: sistema que exige configurar antes de dizer
 * qualquer coisa não é usado.
 *
 * Sem "server-only" porque a tela de ajustes precisa mostrar o padrão ao lado
 * do valor escolhido.
 */

export type Faixa = { ruim: number; bom: number };

export type ChaveRegua = "ctr" | "conexao" | "pagina" | "fechamento";

export type Reguas = Record<ChaveRegua, Faixa>;

export const PADRAO_DAS_REGUAS: Reguas = {
  /** Impressão que vira clique: o criativo convence? */
  ctr: { ruim: 0.008, bom: 0.02 },
  /** Clique que abre a página: caminho, não conteúdo. */
  conexao: { ruim: 0.55, bom: 0.8 },
  /** Visita que vira pedido de contato: a página e a oferta. */
  pagina: { ruim: 0.03, bom: 0.12 },
  /** Contato que vira venda: o atendimento. */
  fechamento: { ruim: 0.08, bom: 0.25 },
};

export const DESCRICAO_DA_REGUA: Record<ChaveRegua, { titulo: string; explica: string }> = {
  ctr: {
    titulo: "Cliques por impressão",
    explica: "Quantos dos que viram o anúncio clicaram. Mede o criativo e o público.",
  },
  conexao: {
    titulo: "Cliques que abrem a página",
    explica: "Quantos dos que clicaram chegaram a carregar a página. Mede velocidade e caminho.",
  },
  pagina: {
    titulo: "Visitas que viram contato",
    explica: "Quantos dos que abriram pediram orçamento. Mede a oferta e o formulário.",
  },
  fechamento: {
    titulo: "Contatos que viram venda",
    explica: "Quantos dos que chegaram fecharam. Mede o atendimento do cliente.",
  },
};

/**
 * Régua por tipo de campanha, para o CTR. Vídeo não existe para gerar clique,
 * e cobrar dele a mesma taxa de uma campanha de lead condena o que está certo.
 */
export const CTR_POR_TIPO: Record<string, Faixa> = {
  conversas: { ruim: 0.01, bom: 0.025 },
  compras: { ruim: 0.006, bom: 0.015 },
  visualizacoes_video: { ruim: 0.004, bom: 0.012 },
  thruplays: { ruim: 0.004, bom: 0.012 },
};
