import "server-only";
import { prisma } from "./prisma";
import { REGRAS, STATUS_ABERTOS } from "./regras";

/**
 * Confirmação em lote pelo cliente.
 *
 * O painel não sabe que a mensagem chegou no WhatsApp: quem sabe é quem atende.
 * Em vez de exigir que a equipe cadastre cada lead, o cliente abre um link uma
 * vez por dia e responde duas perguntas por item: essa pessoa falou comigo? e
 * o que deu nisso?
 *
 * O link não tem senha, e sim um token longo por cliente. Quem tem o link
 * enxerga e responde as pendências daquele cliente, e nada mais.
 */

/** Quanto tempo um clique fica na lista esperando resposta. */
const DIAS_NA_LISTA = 14;

export function gerarToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function clientePorToken(token: string) {
  if (!token || token.length < 32) return null;
  return prisma.cliente.findFirst({
    where: { tokenConfirmacao: token, ativo: true },
    select: { id: true, nome: true, fuso: true },
  });
}

export async function garantirToken(clienteId: string): Promise<string> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { tokenConfirmacao: true },
  });
  if (cliente?.tokenConfirmacao) return cliente.tokenConfirmacao;

  const token = gerarToken();
  await prisma.cliente.update({ where: { id: clienteId }, data: { tokenConfirmacao: token } });
  return token;
}

export async function trocarToken(clienteId: string): Promise<string> {
  const token = gerarToken();
  await prisma.cliente.update({ where: { id: clienteId }, data: { tokenConfirmacao: token } });
  return token;
}

/** As duas listas que o cliente responde: cliques a confirmar e leads sem desfecho. */
export async function pendencias(clienteId: string) {
  const desde = new Date(Date.now() - DIAS_NA_LISTA * 24 * 60 * 60 * 1000);

  const cliques = await prisma.clique.findMany({
    where: { clienteId, lead: null, status: "PENDENTE", criadoEm: { gte: desde } },
    orderBy: { criadoEm: "desc" },
    take: 60,
  });

  const leads = await prisma.lead.findMany({
    where: { clienteId, arquivadoEm: null, status: { in: [...STATUS_ABERTOS] } },
    orderBy: { criadoEm: "asc" },
    include: {
      clique: {
        select: {
          codigo: true,
          adId: true,
          interesse: true,
          nomeVisitante: true,
          telefoneVisitante: true,
        },
      },
    },
    take: 60,
  });

  return { cliques, leads };
}

export async function totalPendencias(clienteId: string) {
  const { cliques, leads } = await pendencias(clienteId);
  return cliques.length + leads.length;
}

/** O clique virou conversa: nasce o lead, com atribuição exata pelo código. */
export async function confirmarConversa(
  clienteId: string,
  cliqueId: string,
  telefone?: string,
  nome?: string,
) {
  const clique = await prisma.clique.findFirst({
    where: { id: cliqueId, clienteId, lead: null },
  });
  if (!clique) return null;

  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        clienteId,
        cliqueId: clique.id,
        telefone: telefone || clique.telefoneVisitante || null,
        nome: nome || clique.nomeVisitante || null,
        origem: "MANUAL",
        status: "NOVO",
        atribuicao: "EXATA",
        mensagemEm: clique.criadoEm,
      },
    });

    await tx.evento.create({
      data: {
        clienteId,
        leadId: lead.id,
        tipo: "MENSAGEM",
        descricao: `Confirmado pelo cliente: o clique ${clique.codigo} virou conversa`,
      },
    });

    await tx.clique.update({ where: { id: clique.id }, data: { status: "CASADO" } });
    return lead;
  });
}

/** O clique não virou conversa: encerra sem virar lead, e sai da lista. */
export async function descartarClique(clienteId: string, cliqueId: string) {
  const { count } = await prisma.clique.updateMany({
    where: { id: cliqueId, clienteId, lead: null },
    data: { status: "SEM_CONTATO" },
  });
  return count > 0;
}

/** Desfecho informado pelo cliente. Vale tanto para lead quanto para clique. */
export async function registrarDesfecho(params: {
  clienteId: string;
  leadId: string;
  status: "FECHADO" | "PERDIDO";
  valorVenda?: number;
  motivoPerda?: string;
}) {
  const { clienteId, leadId, status } = params;
  const lead = await prisma.lead.findFirst({ where: { id: leadId, clienteId } });
  if (!lead) return null;

  if (status === "FECHADO" && !(params.valorVenda && params.valorVenda > 0)) return null;
  if (status === "PERDIDO" && !params.motivoPerda?.trim()) return null;

  return prisma.$transaction(async (tx) => {
    const atualizado = await tx.lead.update({
      where: { id: lead.id },
      data: {
        status,
        valorVenda: status === "FECHADO" ? params.valorVenda : lead.valorVenda,
        motivoPerda: status === "PERDIDO" ? params.motivoPerda?.trim() : lead.motivoPerda,
        fechadoEm: new Date(),
      },
    });

    await tx.evento.create({
      data: {
        clienteId,
        leadId: lead.id,
        tipo: "MUDANCA_STATUS",
        descricao:
          status === "FECHADO"
            ? `Cliente informou venda de R$ ${params.valorVenda?.toFixed(2)}`
            : `Cliente informou perda: ${params.motivoPerda?.trim()}`,
      },
    });

    return atualizado;
  });
}

/** Quanto do rastreamento está sem resposta — o sinal de que o cliente parou de confirmar. */
export async function saudeDoRegistro(clienteId: string, dias = 7) {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  const [cliques, respondidos] = await Promise.all([
    prisma.clique.count({ where: { clienteId, criadoEm: { gte: desde } } }),
    prisma.clique.count({
      where: { clienteId, criadoEm: { gte: desde }, status: { in: ["CASADO", "SEM_CONTATO"] } },
    }),
  ]);

  const semResposta = cliques - respondidos;
  return {
    cliques,
    respondidos,
    semResposta,
    percentualRespondido: cliques > 0 ? Math.round((respondidos / cliques) * 100) : null,
    // Muito clique antigo sem resposta = ninguém está confirmando do outro lado.
    abandonado: cliques >= 5 && respondidos / cliques < 0.3,
  };
}

export { REGRAS };
