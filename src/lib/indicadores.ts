/**
 * Indicador que sabe o quanto sabe.
 *
 * Mostrar zero onde falta dado é o erro mais caro que um painel comete: o
 * número parece uma medição e é uma ausência. "ROAS 0x" faz cortar a campanha
 * que vendeu e ninguém lançou o valor; "0% de qualificação" faz trocar o
 * público quando o cliente só não classificou ninguém.
 *
 * Então todo indicador carrega três coisas: o valor, o quanto ele se sustenta,
 * e a fórmula que o gerou. A tela mostra "parcial" com o motivo em vez do
 * número limpo, e o gestor decide se apresenta ao cliente.
 *
 * Funções puras, testadas sem banco.
 */

export type EstadoIndicador = "exato" | "parcial" | "indisponivel";

export type Indicador = {
  valor: number | null;
  estado: EstadoIndicador;
  /** Por que não é exato. Vazio quando é. */
  motivo: string | null;
  /** Como o número foi calculado, para conferência. */
  formula: string;
};

/** Um número que se sustenta inteiro. */
export function exato(valor: number, formula: string): Indicador {
  return { valor, estado: "exato", motivo: null, formula };
}

/** Computável, mas sobre base incompleta: o valor existe e é um piso ou um viés. */
export function parcial(valor: number, motivo: string, formula: string): Indicador {
  return { valor, estado: "parcial", motivo, formula };
}

/** Não dá para calcular. Nunca vira zero. */
export function indisponivel(motivo: string, formula: string): Indicador {
  return { valor: null, estado: "indisponivel", motivo, formula };
}

/**
 * Divide com honestidade: sem denominador não existe taxa, e zero seria uma
 * afirmação que o dado não faz.
 */
export function razao(
  numerador: number,
  denominador: number,
  opcoes: { formula: string; motivoSemBase: string; ressalva?: string | null },
): Indicador {
  if (denominador <= 0) return indisponivel(opcoes.motivoSemBase, opcoes.formula);
  const valor = numerador / denominador;
  return opcoes.ressalva
    ? parcial(valor, opcoes.ressalva, opcoes.formula)
    : exato(valor, opcoes.formula);
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const vezes = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`;

const FORMATO = { moeda, pct, vezes, inteiro: (v: number) => v.toLocaleString("pt-BR") };

/** O texto que vai para a tela. Indisponível nunca vira "0". */
export function formatar(i: Indicador, como: keyof typeof FORMATO = "moeda"): string {
  if (i.valor == null) return "indisponível";
  return FORMATO[como](i.valor);
}

/* ——— Os indicadores do funil, com a fórmula ao lado ——— */

/**
 * Receita atribuída. Venda fechada sem valor lançado não some da conta: ela
 * vira o motivo de o número ser um piso, não um total.
 */
export function receita(params: {
  soma: number;
  vendasComValor: number;
  vendasTotal: number;
}): Indicador {
  const formula = "soma dos valores de venda dos contatos fechados no período";
  if (params.vendasTotal === 0) return indisponivel("nenhuma venda registrada no período", formula);
  const semValor = params.vendasTotal - params.vendasComValor;
  return semValor > 0
    ? parcial(
        params.soma,
        `${semValor} de ${params.vendasTotal} vendas sem valor lançado: o total é um piso`,
        formula,
      )
    : exato(params.soma, formula);
}

/** Retorno sobre o investido. Herda a incerteza da receita. */
export function roas(receitaIndicador: Indicador, investimento: number): Indicador {
  const formula = "receita registrada ÷ investimento em mídia";
  if (investimento <= 0) return indisponivel("sem investimento no período", formula);
  if (receitaIndicador.valor == null) return indisponivel(receitaIndicador.motivo ?? "sem receita", formula);
  const valor = receitaIndicador.valor / investimento;
  return receitaIndicador.estado === "parcial"
    ? parcial(valor, `${receitaIndicador.motivo}, então o retorno real é maior`, formula)
    : exato(valor, formula);
}

/**
 * Custo por contato. Contato sem origem identificada entra no total do cliente
 * e não na conta do anúncio — então o custo por anúncio é sempre um teto.
 */
export function custoPorContato(params: {
  investimento: number;
  contatos: number;
  semOrigem: number;
}): Indicador {
  const formula = "investimento ÷ contatos do período";
  if (params.contatos <= 0) return indisponivel("nenhum contato no período", formula);
  const valor = params.investimento / params.contatos;
  return params.semOrigem > 0
    ? parcial(
        valor,
        `${params.semOrigem} contatos sem origem identificada ficaram de fora: o custo real é menor`,
        formula,
      )
    : exato(valor, formula);
}

/** Custo por cliente conquistado. */
export function custoPorVenda(investimento: number, vendas: number): Indicador {
  const formula = "investimento ÷ vendas fechadas";
  return vendas > 0
    ? exato(investimento / vendas, formula)
    : indisponivel("nenhuma venda fechada no período", formula);
}

/**
 * Taxa de qualificação. Cliente que nunca usou a etapa tem zero qualificados —
 * e isso não significa lead ruim, significa etapa não usada. Sem essa
 * distinção o número manda trocar o público sem motivo.
 */
export function taxaQualificacao(params: {
  qualificados: number;
  contatos: number;
  algumDiaClassificou: boolean;
}): Indicador {
  const formula = "contatos qualificados ÷ contatos do período";
  if (params.contatos <= 0) return indisponivel("nenhum contato no período", formula);
  if (!params.algumDiaClassificou) {
    return indisponivel("ninguém marcou contato como qualificado ainda", formula);
  }
  return exato(params.qualificados / params.contatos, formula);
}

/**
 * Taxa de fechamento. Enquanto houver contato em aberto o número ainda vai
 * mudar: é piso, não resultado.
 */
export function taxaFechamento(params: {
  fechados: number;
  contatos: number;
  emAberto: number;
}): Indicador {
  const formula = "contatos fechados ÷ contatos do período";
  if (params.contatos <= 0) return indisponivel("nenhum contato no período", formula);
  const valor = params.fechados / params.contatos;
  return params.emAberto > 0
    ? parcial(valor, `${params.emAberto} contatos ainda em aberto: a taxa deve subir`, formula)
    : exato(valor, formula);
}
