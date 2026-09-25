import "server-only";
import { prisma } from "./prisma";

/**
 * Vendas de um lead.
 *
 * O mesmo cliente compra mais de uma vez: fecha um serviço e, semanas depois,
 * fecha outro. Todo esse faturamento veio da mesma mídia e do mesmo contato —
 * mas o lead só tinha um campo de valor, então a segunda venda não tinha onde
 * entrar.
 *
 * A saída não é criar outro lead: isso contaria um contato que nunca chegou, e
 * estragaria custo por contato e taxa de fechamento. Um contato, um cliente,
 * várias vendas.
 *
 * `Lead.valorVenda` continua existindo como o total, recalculado a cada
 * mudança. Relatório, ROAS e custo por venda leem de lá e não mudam de fonte.
 */

/** Soma as vendas e devolve o total gravado no lead. */
async function recalcularTotal(leadId: string): Promise<number | null> {
  const soma = await prisma.venda.aggregate({ where: { leadId }, _sum: { valor: true } });
  const total = soma._sum.valor ? Number(soma._sum.valor) : null;
  await prisma.lead.update({ where: { id: leadId }, data: { valorVenda: total } });
  return total;
}

export async function vendasDoLead(leadId: string) {
  const vendas = await prisma.venda.findMany({
    where: { leadId },
    orderBy: { fechadoEm: "asc" },
    select: { id: true, valor: true, descricao: true, fechadoEm: true },
  });
  return vendas.map((v) => ({ ...v, valor: Number(v.valor) }));
}

/**
 * Registra uma venda. A primeira fecha o lead; as seguintes somam ao total sem
 * mexer no status, porque o lead já está fechado.
 */
export async function registrarVenda(params: {
  leadId: string;
  clienteId: string;
  valor: number;
  descricao?: string | null;
  usuarioId?: string | null;
}) {
  const venda = await prisma.venda.create({
    data: {
      leadId: params.leadId,
      clienteId: params.clienteId,
      valor: params.valor,
      descricao: params.descricao?.trim() || null,
    },
  });

  const total = await recalcularTotal(params.leadId);
  const quantas = await prisma.venda.count({ where: { leadId: params.leadId } });

  const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  await prisma.evento.create({
    data: {
      clienteId: params.clienteId,
      leadId: params.leadId,
      tipo: "MUDANCA_STATUS",
      descricao:
        quantas > 1
          ? `Nova venda de ${moeda(params.valor)}${venda.descricao ? ` (${venda.descricao})` : ""} · total ${moeda(total ?? 0)}`
          : `Fechado por ${moeda(params.valor)}${venda.descricao ? ` (${venda.descricao})` : ""}`,
      usuarioId: params.usuarioId ?? null,
    },
  });

  return { venda, total, quantas };
}

/**
 * Apaga uma venda e refaz o total. Lançar valor errado acontece, e sem isso a
 * correção seria refazer o lead inteiro.
 */
export async function apagarVenda(vendaId: string, agenciaId: string) {
  const venda = await prisma.venda.findFirst({
    where: { id: vendaId, cliente: { agenciaId } },
    select: { id: true, leadId: true, clienteId: true, valor: true },
  });
  if (!venda) return null;

  await prisma.venda.delete({ where: { id: venda.id } });
  const total = await recalcularTotal(venda.leadId);

  const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  await prisma.evento.create({
    data: {
      clienteId: venda.clienteId,
      leadId: venda.leadId,
      tipo: "NOTA",
      descricao: `Venda de ${moeda(Number(venda.valor))} removida · total ${total ? moeda(total) : "zerado"}`,
    },
  });

  return { leadId: venda.leadId, total };
}
