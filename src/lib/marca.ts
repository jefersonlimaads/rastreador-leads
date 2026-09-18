/**
 * Identidade visual da JL Ads, num lugar só.
 *
 * Trocar os valores daqui muda o ícone da aba e a imagem de prévia do link. As
 * cores do painel ficam em src/app/globals.css, nas variáveis do :root — os dois
 * arquivos precisam contar a mesma história.
 *
 * Quando houver arquivo de logo, apontar LOGO para ele e o ícone passa a usar a
 * imagem em vez das iniciais.
 */
export const MARCA = {
  nome: "JL Ads",
  iniciais: "JL",
  /** Caminho da logo dentro de /public, quando existir. */
  logo: null as string | null,

  cores: {
    /** Cor de ação: botões, links, destaque de seleção. */
    marca: "#1f6feb",
    /** Fundo das telas escuras, como a imagem de prévia. */
    fundoEscuro: "#0d0f12",
    textoClaro: "#f2f4f7",
    textoSuave: "#98a2b0",
  },
} as const;
