import "server-only";
import { prisma } from "./prisma";

/**
 * Catálogo de serviços: o que a agência sabe vender.
 *
 * Existe para a proposta ser montada marcando caixinhas, e não reescrevendo o
 * escopo do zero toda vez — que é onde some item combinado e entra item que
 * ninguém vai entregar. A proposta guarda uma cópia do que foi marcado, então
 * editar o catálogo depois não mexe no que já foi enviado.
 */

export type Servico = {
  id: string;
  nome: string;
  detalhe: string | null;
  ordem: number;
  ativo: boolean;
};

/** Primeira lista de uma agência nova. Daí em diante ela edita o que quiser. */
const PADRAO: { nome: string; detalhe: string }[] = [
  {
    nome: "Gestão de campanhas no Meta Ads",
    detalhe: "Estrutura, criação, testes e otimização contínua de Facebook e Instagram",
  },
  {
    nome: "Gestão de campanhas no Google Ads",
    detalhe: "Pesquisa, Performance Max e remarketing",
  },
  {
    nome: "Rastreamento de leads",
    detalhe: "Cada conversa no WhatsApp ligada ao anúncio que a gerou",
  },
  {
    nome: "Painel de resultados",
    detalhe: "Leads, custo por lead e custo por venda, atualizado todo dia",
  },
  {
    nome: "Criativos",
    detalhe: "Roteiro e direção de até 4 peças por mês",
  },
  {
    nome: "Landing page",
    detalhe: "Página de captura criada e hospedada, com formulário e WhatsApp",
  },
  {
    nome: "Configuração de pixel e API de Conversões",
    detalhe: "Para o Meta aprender com quem realmente virou cliente",
  },
  {
    nome: "Reunião mensal de resultado",
    detalhe: "O que funcionou, o que muda no mês seguinte",
  },
  {
    nome: "Relatório mensal",
    detalhe: "Documento com os números do período, enviado por link",
  },
  {
    nome: "Suporte no WhatsApp",
    detalhe: "Canal direto em horário comercial",
  },
];

/**
 * Serviços da agência. Na primeira vez, semeia a lista padrão: catálogo vazio
 * deixaria a tela de proposta sem nada para marcar.
 */
export async function servicosDaAgencia(agenciaId: string): Promise<Servico[]> {
  const existentes = await prisma.servicoProposta.findMany({
    where: { agenciaId },
    orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
  });
  if (existentes.length > 0) return existentes;

  await prisma.servicoProposta.createMany({
    data: PADRAO.map((s, i) => ({ agenciaId, nome: s.nome, detalhe: s.detalhe, ordem: i })),
  });
  return prisma.servicoProposta.findMany({
    where: { agenciaId },
    orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
  });
}

export async function criarServico(agenciaId: string, nome: string, detalhe: string | null) {
  const ultimo = await prisma.servicoProposta.findFirst({
    where: { agenciaId },
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });
  return prisma.servicoProposta.create({
    data: { agenciaId, nome, detalhe, ordem: (ultimo?.ordem ?? -1) + 1 },
  });
}

/**
 * Serviço sai de circulação em vez de ser apagado: proposta antiga guarda a
 * cópia dele, mas o histórico do catálogo continua fazendo sentido.
 */
export async function alternarServico(agenciaId: string, id: string) {
  const s = await prisma.servicoProposta.findFirst({ where: { id, agenciaId } });
  if (!s) return null;
  return prisma.servicoProposta.update({ where: { id }, data: { ativo: !s.ativo } });
}

export async function excluirServico(agenciaId: string, id: string) {
  const s = await prisma.servicoProposta.findFirst({ where: { id, agenciaId } });
  if (!s) return null;
  return prisma.servicoProposta.delete({ where: { id } });
}
