import "server-only";
import { prisma } from "./prisma";
import { dataPuraDe, FUSO_PADRAO } from "./datas";

/**
 * Diário de otimização: o que foi mexido, quando, e o que aconteceu depois.
 *
 * Toda entrega registrada vira uma marca na linha do tempo, e o sistema mede
 * os 7 dias antes contra os 7 dias depois. Não é prova de causa — muita coisa
 * muda junto —, mas é a diferença entre "acho que melhorou" e um número que dá
 * para mostrar na reunião.
 *
 * A janela só fecha quando os 7 dias seguintes já passaram: antes disso a
 * comparação seria com meio período, que é pior do que não comparar.
 */

const DIA_MS = 24 * 60 * 60 * 1000;
const JANELA = 7;

export type MudancaDiario = {
  id: string;
  tipo: string;
  descricao: string;
  em: Date;
  /** Null enquanto os 7 dias seguintes não fecharam. */
  efeito: {
    gastoAntes: number;
    gastoDepois: number;
    contatosAntes: number;
    contatosDepois: number;
    custoAntes: number | null;
    custoDepois: number | null;
    /** Variação do custo por contato: negativo é melhora. */
    variacao: number | null;
    resumo: string;
  } | null;
};

export async function diarioDoCliente(
  clienteId: string,
  fuso = FUSO_PADRAO,
  limite = 12,
): Promise<MudancaDiario[]> {
  const entregas = await prisma.entrega.findMany({
    where: { clienteId },
    orderBy: { criadoEm: "desc" },
    take: limite,
    select: { id: true, tipo: true, descricao: true, criadoEm: true },
  });
  if (entregas.length === 0) return [];

  const maisAntiga = entregas[entregas.length - 1].criadoEm;
  const de = new Date(maisAntiga.getTime() - JANELA * DIA_MS);
  const ate = new Date();

  const [gastos, leads] = await Promise.all([
    prisma.gasto.findMany({
      where: { clienteId, dia: { gte: dataPuraDe(de, fuso) } },
      select: { dia: true, valor: true },
    }),
    prisma.lead.findMany({
      where: { clienteId, arquivadoEm: null, criadoEm: { gte: de, lte: ate } },
      select: { criadoEm: true },
    }),
  ]);

  const agora = Date.now();

  return entregas.map((e) => {
    const marco = e.criadoEm.getTime();
    const fimDepois = marco + JANELA * DIA_MS;
    if (fimDepois > agora) {
      return { id: e.id, tipo: e.tipo, descricao: e.descricao, em: e.criadoEm, efeito: null };
    }

    // Gasto é por dia puro: a marca do dia da mudança conta para o "depois".
    const diaDaMudanca = dataPuraDe(e.criadoEm, fuso).getTime();
    const somaGasto = (inicio: number, fim: number) =>
      gastos
        .filter((g) => g.dia.getTime() >= inicio && g.dia.getTime() < fim)
        .reduce((s, g) => s + Number(g.valor), 0);
    const contaLeads = (inicio: number, fim: number) =>
      leads.filter((l) => l.criadoEm.getTime() >= inicio && l.criadoEm.getTime() < fim).length;

    const gastoAntes = somaGasto(diaDaMudanca - JANELA * DIA_MS, diaDaMudanca);
    const gastoDepois = somaGasto(diaDaMudanca, diaDaMudanca + JANELA * DIA_MS);
    const contatosAntes = contaLeads(marco - JANELA * DIA_MS, marco);
    const contatosDepois = contaLeads(marco, fimDepois);

    const custoAntes = contatosAntes > 0 && gastoAntes > 0 ? gastoAntes / contatosAntes : null;
    const custoDepois = contatosDepois > 0 && gastoDepois > 0 ? gastoDepois / contatosDepois : null;
    const variacao =
      custoAntes != null && custoDepois != null ? (custoDepois - custoAntes) / custoAntes : null;

    const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    let resumo: string;
    if (gastoAntes === 0 && gastoDepois === 0) {
      resumo = "Sem investimento nos 7 dias antes ou depois: não há o que comparar.";
    } else if (variacao == null) {
      resumo = `${contatosAntes} contatos antes, ${contatosDepois} depois (${moeda(gastoAntes)} contra ${moeda(gastoDepois)} investidos).`;
    } else {
      const sinal = variacao <= -0.1 ? "caiu" : variacao >= 0.1 ? "subiu" : "ficou parecido";
      resumo =
        sinal === "ficou parecido"
          ? `Custo por contato praticamente igual: ${moeda(custoAntes!)} antes, ${moeda(custoDepois!)} depois.`
          : `Custo por contato ${sinal} ${Math.abs(Math.round(variacao * 100))}%: ${moeda(custoAntes!)} antes, ${moeda(custoDepois!)} depois (${contatosAntes} contra ${contatosDepois} contatos).`;
    }

    return {
      id: e.id,
      tipo: e.tipo,
      descricao: e.descricao,
      em: e.criadoEm,
      efeito: {
        gastoAntes,
        gastoDepois,
        contatosAntes,
        contatosDepois,
        custoAntes,
        custoDepois,
        variacao,
        resumo,
      },
    };
  });
}
