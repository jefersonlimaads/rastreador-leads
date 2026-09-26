import "server-only";
import { prisma } from "./prisma";
import { dataPuraDe, FUSO_PADRAO, partesLocais } from "./datas";

/**
 * A série do período, dia a dia: investimento e contatos.
 *
 * Existe para responder "quando mudou?", que nenhum total responde. Um custo
 * por contato médio de R$ 6 pode ser seis dias a R$ 4 e um dia a R$ 18 —
 * e é esse dia que tem explicação.
 *
 * A taxa de cada dia sai dos números daquele dia. A taxa do período inteiro
 * nunca é a média das diárias: soma-se o de cima e o de baixo, e divide-se
 * uma vez só. Média de percentual dá peso igual a um dia de R$ 5 e a um de
 * R$ 500.
 */

export type DiaDaSerie = {
  /** "2026-09-15", no fuso do cliente. */
  dia: string;
  rotulo: string;
  investimento: number;
  contatos: number;
  vendas: number;
  /** Do próprio dia. Null quando não houve contato. */
  custoPorContato: number | null;
};

export async function evolucaoDiaria(
  clienteId: string,
  de: Date,
  ate: Date,
  fuso: string = FUSO_PADRAO,
): Promise<DiaDaSerie[]> {
  const [gastos, leads] = await Promise.all([
    prisma.gasto.findMany({
      where: { clienteId, dia: { gte: dataPuraDe(de, fuso), lte: dataPuraDe(ate, fuso) } },
      select: { dia: true, valor: true },
    }),
    prisma.lead.findMany({
      where: { clienteId, arquivadoEm: null, criadoEm: { gte: de, lte: ate } },
      select: { criadoEm: true, status: true },
    }),
  ]);

  const serie = new Map<string, DiaDaSerie>();
  const chave = (d: Date) => d.toISOString().slice(0, 10);

  // Todos os dias do período existem, mesmo os vazios: buraco no gráfico
  // esconde o dia em que a campanha ficou fora do ar.
  const primeiro = dataPuraDe(de, fuso);
  const ultimo = dataPuraDe(ate, fuso);
  for (let d = new Date(primeiro); d <= ultimo; d = new Date(d.getTime() + 864e5)) {
    const iso = chave(d);
    serie.set(iso, {
      dia: iso,
      rotulo: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
      investimento: 0,
      contatos: 0,
      vendas: 0,
      custoPorContato: null,
    });
  }

  for (const g of gastos) {
    const d = serie.get(chave(g.dia));
    if (d) d.investimento += Number(g.valor);
  }

  for (const l of leads) {
    const p = partesLocais(l.criadoEm, fuso);
    const iso = `${p.ano}-${String(p.mes).padStart(2, "0")}-${String(p.dia).padStart(2, "0")}`;
    const d = serie.get(iso);
    if (!d) continue;
    d.contatos++;
    if (l.status === "FECHADO") d.vendas++;
  }

  for (const d of serie.values()) {
    d.custoPorContato = d.contatos > 0 && d.investimento > 0 ? d.investimento / d.contatos : null;
  }

  return [...serie.values()];
}
