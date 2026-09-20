import "server-only";
import { prisma } from "./prisma";
import { FUSO_PADRAO, hojeComoDataPura, instanteLocal } from "./datas";
import { contatosSoDoMeta, type Acoes } from "./resultados";

/**
 * Meta do mês e ritmo de gasto.
 *
 * A pergunta que isso responde é a do dia 20: "no ritmo de hoje, esse mês
 * fecha acima ou abaixo do combinado?". A projeção é linear de propósito —
 * gasto por dia corrido vezes os dias do mês. Simples, explicável e suficiente
 * para decidir se sobe ou segura o orçamento.
 */

export type RitmoDoMes = {
  diasCorridos: number;
  diasNoMes: number;
  gasto: number;
  orcamento: number | null;
  /** Quanto do orçamento já foi usado (0 a 1+). */
  usado: number | null;
  projecaoGasto: number;
  /** "acima" = vai estourar o orçamento; "abaixo" = vai sobrar. */
  ritmo: "acima" | "abaixo" | "no_ritmo" | null;
  contatos: number;
  metaContatos: number | null;
  projecaoContatos: number;
  cpl: number | null;
  metaCpl: number | null;
  /** Frase pronta, do jeito que se fala com o cliente. */
  resumo: string;
};

/** Margem de 10% para cima ou para baixo: antes disso, o mês está no ritmo. */
const MARGEM = 0.1;

export async function ritmoDoMes(clienteId: string): Promise<RitmoDoMes | null> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { fuso: true, orcamentoMensal: true, metaContatos: true, metaCpl: true },
  });
  if (!cliente) return null;
  const fuso = cliente.fuso ?? FUSO_PADRAO;

  const hoje = hojeComoDataPura(fuso);
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth();
  const primeiro = new Date(Date.UTC(ano, mes, 1));
  const diasNoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const diasCorridos = hoje.getUTCDate();

  const inicio = instanteLocal(ano, mes + 1, 1, 0, 0, fuso);
  const fim = new Date(instanteLocal(ano, mes + 1, diasCorridos + 1, 0, 0, fuso).getTime() - 1);

  const [gastos, visitas, leads] = await Promise.all([
    prisma.gasto.findMany({
      where: { clienteId, dia: { gte: primeiro, lte: hoje } },
      select: { valor: true, acoes: true, otimizacao: true, objetivo: true },
    }),
    prisma.clique.count({ where: { clienteId, criadoEm: { gte: inicio, lte: fim } } }),
    prisma.lead.count({ where: { clienteId, arquivadoEm: null, criadoEm: { gte: inicio, lte: fim } } }),
  ]);

  const gasto = gastos.reduce((s, g) => s + Number(g.valor), 0);
  const soDoMeta = gastos.reduce(
    (s, g) => s + contatosSoDoMeta({ ...g, acoes: g.acoes as Acoes | null }, visitas > 0),
    0,
  );
  const contatos = leads + soDoMeta;

  const orcamento = cliente.orcamentoMensal ? Number(cliente.orcamentoMensal) : null;
  const metaContatos = cliente.metaContatos ?? null;
  const metaCpl = cliente.metaCpl ? Number(cliente.metaCpl) : null;

  const porDia = diasCorridos > 0 ? gasto / diasCorridos : 0;
  const projecaoGasto = porDia * diasNoMes;
  const projecaoContatos = diasCorridos > 0 ? Math.round((contatos / diasCorridos) * diasNoMes) : 0;
  const cpl = contatos > 0 && gasto > 0 ? gasto / contatos : null;
  const usado = orcamento ? gasto / orcamento : null;

  const ritmo =
    orcamento == null
      ? null
      : projecaoGasto > orcamento * (1 + MARGEM)
        ? "acima"
        : projecaoGasto < orcamento * (1 - MARGEM)
          ? "abaixo"
          : "no_ritmo";

  const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const partes: string[] = [`Dia ${diasCorridos} de ${diasNoMes}`];
  if (orcamento) {
    partes.push(
      `${moeda(gasto)} de ${moeda(orcamento)} (${Math.round((usado ?? 0) * 100)}%), projeção de ${moeda(projecaoGasto)}`,
    );
  } else {
    partes.push(`${moeda(gasto)} investidos`);
  }
  if (metaContatos) partes.push(`${contatos} de ${metaContatos} contatos, projeção de ${projecaoContatos}`);
  else if (contatos) partes.push(`${contatos} contatos`);
  if (cpl != null) partes.push(`custo por contato ${moeda(cpl)}${metaCpl ? ` (meta ${moeda(metaCpl)})` : ""}`);

  return {
    diasCorridos,
    diasNoMes,
    gasto,
    orcamento,
    usado,
    projecaoGasto,
    ritmo,
    contatos,
    metaContatos,
    projecaoContatos,
    cpl,
    metaCpl,
    resumo: partes.join(" · "),
  };
}
