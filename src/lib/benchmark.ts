import "server-only";
import { prisma } from "./prisma";
import { anunciosDoPeriodo } from "./campanhas";
import { FUSO_PADRAO } from "./datas";
import { RESULTADO, type TipoResultado } from "./resultados";

/**
 * Comparação com o resto da carteira.
 *
 * "R$ 12 por conversa" não diz nada sozinho: é caro ou barato? A régua honesta
 * que existe aqui dentro é a própria carteira da agência — os outros clientes
 * que rodam o mesmo tipo de resultado no mesmo período. Quando há clientes do
 * mesmo nicho, a comparação fica mais justa e o texto diz isso.
 *
 * O que NÃO se faz aqui: inventar média de mercado. Número de internet não
 * sobrevive a uma pergunta do cliente, e o que se ganha em conforto se perde
 * na primeira reunião.
 */

export type Benchmark = {
  tipo: TipoResultado;
  /** Custo por resultado do cliente no período. */
  custo: number;
  /** Mediana dos outros clientes comparáveis. */
  mediana: number;
  /** Quantos outros clientes entraram na conta. */
  comparados: number;
  /** true quando todos os comparados são do mesmo nicho. */
  mesmoNicho: boolean;
  nicho: string | null;
  posicao: "melhor" | "parecido" | "pior";
  resumo: string;
};

/** Menos de dois comparáveis não é régua, é opinião. */
const MINIMO = 2;

export async function compararComACarteira(
  clienteId: string,
  de: Date,
  ate: Date,
): Promise<Benchmark | null> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { agenciaId: true, nicho: true, fuso: true },
  });
  if (!cliente) return null;

  const outros = await prisma.cliente.findMany({
    where: { agenciaId: cliente.agenciaId, ativo: true, ciclo: "ATIVO", id: { not: clienteId } },
    select: { id: true, nicho: true, fuso: true },
  });
  if (outros.length < MINIMO) return null;

  const custoDe = (anuncios: Awaited<ReturnType<typeof anunciosDoPeriodo>>, tipo?: TipoResultado) => {
    const doTipo = tipo ? anuncios.filter((a) => a.tipo === tipo) : anuncios;
    const gasto = doTipo.reduce((s, a) => s + a.gasto, 0);
    const resultados = doTipo.reduce((s, a) => s + a.resultados, 0);
    return resultados > 0 && gasto > 0 ? gasto / resultados : null;
  };

  const meus = await anunciosDoPeriodo(clienteId, de, ate, cliente.fuso ?? FUSO_PADRAO);
  if (meus.length === 0) return null;

  // O tipo de resultado que mais consome orçamento é o que vale comparar.
  const gastoPorTipo = new Map<TipoResultado, number>();
  for (const a of meus) gastoPorTipo.set(a.tipo, (gastoPorTipo.get(a.tipo) ?? 0) + a.gasto);
  const tipo = [...gastoPorTipo.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
  if (!tipo) return null;

  const custo = custoDe(meus, tipo);
  if (custo == null) return null;

  const doNicho = cliente.nicho
    ? outros.filter((o) => o.nicho && o.nicho.toLowerCase() === cliente.nicho!.toLowerCase())
    : [];
  // Mesmo nicho quando dá; senão, a carteira inteira, dito com todas as letras.
  const base = doNicho.length >= MINIMO ? doNicho : outros;
  const mesmoNicho = base === doNicho;

  const custos: number[] = [];
  for (const o of base) {
    const deles = await anunciosDoPeriodo(o.id, de, ate, o.fuso ?? FUSO_PADRAO);
    const c = custoDe(deles, tipo);
    if (c != null) custos.push(c);
  }
  if (custos.length < MINIMO) return null;

  custos.sort((a, b) => a - b);
  const meio = Math.floor(custos.length / 2);
  const mediana = custos.length % 2 ? custos[meio] : (custos[meio - 1] + custos[meio]) / 2;

  const rotulo = RESULTADO[tipo];
  const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const posicao = custo <= mediana * 0.85 ? "melhor" : custo >= mediana * 1.15 ? "pior" : "parecido";
  const onde = mesmoNicho
    ? `de ${custos.length} ${custos.length === 1 ? "cliente" : "clientes"} do mesmo nicho`
    : `de ${custos.length} ${custos.length === 1 ? "outro cliente" : "outros clientes"} da carteira`;

  return {
    tipo,
    custo,
    mediana,
    comparados: custos.length,
    mesmoNicho,
    nicho: mesmoNicho ? cliente.nicho : null,
    posicao,
    resumo:
      posicao === "parecido"
        ? `${moeda(custo)} ${rotulo.custo}, na mesma faixa ${onde} (${moeda(mediana)}).`
        : posicao === "melhor"
          ? `${moeda(custo)} ${rotulo.custo}, abaixo dos ${moeda(mediana)} ${onde}.`
          : `${moeda(custo)} ${rotulo.custo}, acima dos ${moeda(mediana)} ${onde}.`,
  };
}
