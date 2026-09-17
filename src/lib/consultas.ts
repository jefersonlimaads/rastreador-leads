import "server-only";
import { prisma } from "./prisma";
import { REGRAS, STATUS_ABERTOS } from "./regras";
import type { LeadCartao } from "@/app/(painel)/componentes";
import type { Prisma } from "@prisma/client";

const INCLUIR = {
  clique: { select: { adId: true, utmCampaign: true, utmContent: true } },
  eventos: { orderBy: { criadoEm: "desc" }, take: 1, select: { criadoEm: true } },
} satisfies Prisma.LeadInclude;

type LeadComRelacoes = Prisma.LeadGetPayload<{ include: typeof INCLUIR }>;

function paraCartao(lead: LeadComRelacoes): LeadCartao {
  return {
    id: lead.id,
    nome: lead.nome,
    telefone: lead.telefone,
    status: lead.status,
    atribuicao: lead.atribuicao,
    criadoEm: lead.criadoEm,
    ultimoEventoEm: lead.eventos[0]?.criadoEm ?? null,
    anuncio: lead.clique?.utmContent ?? lead.clique?.adId ?? null,
    valorVenda: lead.valorVenda ? Number(lead.valorVenda) : null,
  };
}

/** Tela Hoje: o que precisa de ação agora, nas três filas do escopo. */
export async function filaDoDia(clienteId: string) {
  const agora = Date.now();
  const limiteNovo = new Date(agora - REGRAS.destaqueNovoHoras * 60 * 60 * 1000);
  const limiteFollowUp = new Date(agora - REGRAS.followUpDias * 24 * 60 * 60 * 1000);

  const abertos = await prisma.lead.findMany({
    where: { clienteId, arquivadoEm: null, status: { in: [...STATUS_ABERTOS] } },
    include: INCLUIR,
    orderBy: { criadoEm: "desc" },
    take: 200,
  });

  const novos: LeadCartao[] = [];
  const parados: LeadCartao[] = [];
  const followUp: LeadCartao[] = [];

  for (const lead of abertos) {
    const cartao = paraCartao(lead);
    const ultimo = cartao.ultimoEventoEm ?? lead.criadoEm;

    if (lead.status === "NOVO" && lead.criadoEm < limiteNovo) {
      // Regra 8: novo há mais de 2 horas, ninguém respondeu.
      parados.push(cartao);
    } else if (lead.status === "NOVO") {
      novos.push(cartao);
    } else if (ultimo < limiteFollowUp) {
      // Regra 9: em atendimento, mas parado há dias.
      followUp.push(cartao);
    }
  }

  // Regra 9 também alcança lead novo esquecido há dias.
  const paradosAntigos = parados.filter((l) => (l.ultimoEventoEm ?? l.criadoEm) < limiteFollowUp);
  for (const l of paradosAntigos) {
    if (!followUp.find((f) => f.id === l.id)) followUp.push(l);
  }

  const cliquesPendentes = await prisma.clique.count({
    where: { clienteId, status: "PENDENTE", lead: null },
  });

  return { novos, parados, followUp, cliquesPendentes };
}

export type FiltroLeads = {
  busca?: string;
  status?: string;
  adId?: string;
  de?: Date;
  ate?: Date;
};

export async function listarLeads(clienteId: string, filtro: FiltroLeads = {}) {
  const where: Prisma.LeadWhereInput = { clienteId, arquivadoEm: null };

  if (filtro.status) where.status = filtro.status as Prisma.EnumStatusLeadFilter["equals"];
  if (filtro.adId) where.clique = { adId: filtro.adId };
  if (filtro.de || filtro.ate) {
    where.criadoEm = { gte: filtro.de, lte: filtro.ate };
  }
  if (filtro.busca) {
    const busca = filtro.busca.trim();
    where.OR = [
      { nome: { contains: busca, mode: "insensitive" } },
      { telefone: { contains: busca.replace(/\D/g, "") } },
    ];
  }

  const leads = await prisma.lead.findMany({
    where,
    include: INCLUIR,
    orderBy: { criadoEm: "desc" },
    take: 200,
  });

  return leads.map(paraCartao);
}

/** Tela Pipeline: leads abertos agrupados por status. */
export async function pipeline(clienteId: string) {
  const leads = await prisma.lead.findMany({
    where: { clienteId, arquivadoEm: null },
    include: INCLUIR,
    orderBy: { criadoEm: "desc" },
    take: 300,
  });

  const colunas: Record<string, LeadCartao[]> = {
    NOVO: [],
    EM_ATENDIMENTO: [],
    ORCAMENTO_ENVIADO: [],
    FECHADO: [],
    PERDIDO: [],
  };

  for (const lead of leads) {
    colunas[lead.status]?.push(paraCartao(lead));
  }

  return colunas;
}

export async function detalheLead(clienteId: string, leadId: string) {
  return prisma.lead.findFirst({
    where: { id: leadId, clienteId },
    include: {
      clique: true,
      responsavel: { select: { nome: true } },
      leadAnterior: { select: { id: true, criadoEm: true, status: true } },
      eventos: {
        orderBy: { criadoEm: "desc" },
        include: { usuario: { select: { nome: true } } },
      },
      enviosCapi: { orderBy: { criadoEm: "desc" } },
    },
  });
}

/** Cliques ainda sem lead, para o atendente conferir na hora do cadastro. */
export async function cliquesRecentes(clienteId: string, limite = 10) {
  return prisma.clique.findMany({
    where: { clienteId, lead: null, status: "PENDENTE" },
    orderBy: { criadoEm: "desc" },
    take: limite,
  });
}
