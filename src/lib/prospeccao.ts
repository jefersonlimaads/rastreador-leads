import "server-only";
import { prisma } from "./prisma";
import { CICLOS_ANTES_DA_PROPOSTA, CICLOS_EM_PROSPECCAO } from "./regras";
import { hojeComoDataPura } from "./datas";
import { aoMudarEtapa } from "./automacoes";
import type { CicloCliente, TipoInteracao } from "@prisma/client";

/**
 * Prospecção da jl.ads: do "a abordar" até a proposta.
 *
 * Antes da proposta, a etapa é sua: você move conforme a conversa anda. Depois
 * que existe proposta, quem manda na etapa é ela — enviada, negociando, aceita,
 * recusada. sincronizarCiclo é o único lugar que traduz uma coisa na outra.
 */

const CICLOS_DE_CLIENTE: CicloCliente[] = ["ATIVO", "PAUSADO", "ENCERRADO"];

/**
 * Recalcula a etapa do prospect a partir das propostas que existem hoje.
 *
 * Chamada depois de enviar, negociar, recusar ou excluir proposta. Antes disso a
 * etapa só andava para frente: excluir a proposta deixava o prospect em
 * "proposta enviada" sem proposta nenhuma.
 */
export async function sincronizarCiclo(clienteId: string) {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { ciclo: true, propostas: { select: { status: true, respondidaEm: true, criadoEm: true } } },
  });
  if (!cliente) return;

  // Cliente de verdade não volta a ser prospect por causa de proposta.
  if (CICLOS_DE_CLIENTE.includes(cliente.ciclo)) {
    await aoMudarEtapa(clienteId);
    return;
  }

  const propostas = cliente.propostas;
  let novo: CicloCliente;

  if (propostas.some((p) => p.status === "ACEITA")) {
    novo = "ATIVO";
  } else if (propostas.some((p) => p.status === "NEGOCIANDO")) {
    novo = "NEGOCIANDO";
  } else if (propostas.some((p) => p.status === "ENVIADA")) {
    novo = "PROPOSTA_ENVIADA";
  } else if (propostas.length > 0 && propostas.every((p) => p.status === "RECUSADA")) {
    novo = "PERDIDO";
  } else if ((CICLOS_ANTES_DA_PROPOSTA as readonly string[]).includes(cliente.ciclo)) {
    // Sem proposta viva e já numa etapa manual: fica onde você deixou.
    await aoMudarEtapa(clienteId);
    return;
  } else {
    // Estava em etapa de proposta e a proposta sumiu: volta para a última
    // etapa que faz sentido sem ela.
    novo = "REUNIAO_MARCADA";
  }

  if (novo !== cliente.ciclo) {
    await prisma.cliente.update({ where: { id: clienteId }, data: { ciclo: novo } });
  }
  await aoMudarEtapa(clienteId);
}

export type ProspectLista = {
  id: string;
  nome: string;
  ciclo: string;
  nicho: string | null;
  origem: string | null;
  contatoNome: string | null;
  contatoTelefone: string | null;
  proximoContato: Date | null;
  ultimaInteracao: { tipo: string; descricao: string; criadoEm: Date } | null;
  propostaEmAberto: boolean;
};

export async function listarProspects() {
  const prospects = await prisma.cliente.findMany({
    where: { ativo: true, ciclo: { in: [...CICLOS_EM_PROSPECCAO] } },
    orderBy: [{ proximoContato: { sort: "asc", nulls: "last" } }, { criadoEm: "desc" }],
    include: {
      interacoes: { orderBy: { criadoEm: "desc" }, take: 1 },
      propostas: { where: { status: { in: ["ENVIADA", "NEGOCIANDO"] } }, select: { id: true } },
    },
  });

  const hoje = hojeComoDataPura();

  const lista: ProspectLista[] = prospects.map((p) => ({
    id: p.id,
    nome: p.nome,
    ciclo: p.ciclo,
    nicho: p.nicho,
    origem: p.origem,
    contatoNome: p.contatoNome,
    contatoTelefone: p.contatoTelefone,
    proximoContato: p.proximoContato,
    ultimaInteracao: p.interacoes[0]
      ? {
          tipo: p.interacoes[0].tipo,
          descricao: p.interacoes[0].descricao,
          criadoEm: p.interacoes[0].criadoEm,
        }
      : null,
    propostaEmAberto: p.propostas.length > 0,
  }));

  return {
    lista,
    paraHoje: lista.filter((p) => p.proximoContato && p.proximoContato <= hoje),
    perdidos: await prisma.cliente.count({ where: { ativo: true, ciclo: "PERDIDO" } }),
  };
}

/**
 * Registrar um toque. Anda a etapa e marca o próximo contato no mesmo gesto,
 * porque é assim que acontece: você manda a mensagem e já decide quando volta.
 */
export async function registrarInteracao(params: {
  clienteId: string;
  tipo: TipoInteracao;
  descricao: string;
  novaEtapa?: CicloCliente | null;
  proximoContato?: Date | null;
  /** Obrigatória na prática para "reunião marcada": é o que vai para a agenda. */
  reuniaoEm?: Date | null;
}) {
  const { clienteId, tipo, descricao, novaEtapa, proximoContato, reuniaoEm } = params;

  await prisma.$transaction(async (tx) => {
    await tx.interacao.create({ data: { clienteId, tipo, descricao } });

    const cliente = await tx.cliente.findUniqueOrThrow({ where: { id: clienteId } });
    const podeMover =
      novaEtapa &&
      (CICLOS_ANTES_DA_PROPOSTA as readonly string[]).includes(novaEtapa) &&
      (CICLOS_ANTES_DA_PROPOSTA as readonly string[]).includes(cliente.ciclo);

    await tx.cliente.update({
      where: { id: clienteId },
      data: {
        ...(podeMover ? { ciclo: novaEtapa } : {}),
        ...(proximoContato !== undefined ? { proximoContato } : {}),
        ...(reuniaoEm ? { reuniaoEm } : {}),
      },
    });
  });

  await aoMudarEtapa(clienteId);
}

/** Perdido exige motivo, pelo mesmo motivo que a recusa de proposta exige. */
export async function marcarPerdido(clienteId: string, motivo: string) {
  const texto = motivo.trim();
  if (texto.length < 10) return { erro: "Escreva o motivo em uma frase." };

  await prisma.$transaction([
    prisma.cliente.update({
      where: { id: clienteId },
      data: { ciclo: "PERDIDO", motivoPerda: texto, proximoContato: null },
    }),
    prisma.interacao.create({
      data: { clienteId, tipo: "NOTA", descricao: `Marcado como perdido: ${texto}` },
    }),
  ]);
  await aoMudarEtapa(clienteId);
  return { ok: true };
}

/** Perdido pode voltar: o "agora não" de hoje é o cliente de daqui a seis meses. */
export async function reativarProspect(clienteId: string) {
  await prisma.$transaction([
    prisma.cliente.update({
      where: { id: clienteId },
      data: { ciclo: "PROSPECCAO", motivoPerda: null },
    }),
    prisma.interacao.create({
      data: { clienteId, tipo: "NOTA", descricao: "Voltou para a prospecção" },
    }),
  ]);
  await aoMudarEtapa(clienteId);
}

/**
 * Excluir de vez. Só para prospect sem nada que conte história: sem lead, sem
 * clique, sem fatura, sem proposta aceita. Prospect com passado se marca como
 * perdido, não se apaga.
 */
export async function excluirProspect(clienteId: string) {
  const c = await prisma.cliente.findUnique({
    where: { id: clienteId },
    include: {
      _count: { select: { leads: true, cliques: true, faturas: true } },
      propostas: { where: { status: "ACEITA" }, select: { id: true } },
    },
  });
  if (!c) return { erro: "Prospect não encontrado." };
  if (!(CICLOS_EM_PROSPECCAO as readonly string[]).includes(c.ciclo) && c.ciclo !== "PERDIDO") {
    return { erro: "Só prospect pode ser excluído. Cliente se encerra no Negócio." };
  }
  if (c._count.leads || c._count.cliques || c._count.faturas || c.propostas.length) {
    return { erro: "Esse prospect já tem histórico. Marque como perdido em vez de excluir." };
  }

  await prisma.$transaction([
    prisma.tarefa.deleteMany({ where: { clienteId } }),
    prisma.proposta.deleteMany({ where: { clienteId } }),
    prisma.numeroWhatsapp.deleteMany({ where: { clienteId } }),
    prisma.cliente.delete({ where: { id: clienteId } }),
  ]);
  return { ok: true };
}
