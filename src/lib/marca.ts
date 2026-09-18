/**
 * Identidade visual jl.ads, conforme o Guia de Identidade Visual & Verbal
 * (versão 1.1, julho de 2026). As mesmas cores estão em globals.css, nas
 * variáveis do :root — os dois arquivos precisam contar a mesma história.
 *
 * Regras do guia que o código respeita:
 * - O logotipo é sempre "jl.ads", minúsculo e junto. Nunca "JL Ads".
 * - Só o ponto recebe cor. Em fundo escuro, lima; em fundo claro, oliva.
 * - Lima é destaque, nunca texto sobre off-white: reprova em contraste.
 * - Em avatar e favicon, "jl.ads" centralizado no bloco lima.
 */
export const MARCA = {
  nome: "jl.ads",
  assinatura: "jeferson lima.",

  cores: {
    grafite: "#141414",
    offWhite: "#F6F4EF",
    lima: "#D8F34F",
    /** Lima escurecido, para o ponto do logo sobre fundo claro. */
    oliva: "#B7CE2E",
    cinzaPedra: "#8A8A85",
  },

  /** Texto que vai por cima do lima. Contraste 12,6:1, aprovado AAA. */
  sobreLima: "#141414",
} as const;
