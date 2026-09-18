import "server-only";
import { prisma } from "./prisma";
import { dataPuraDe, hojeComoDataPura } from "./datas";
import type { CicloCliente } from "@prisma/client";

/**
 * Tarefas que nascem sozinhas quando o prospect muda de etapa.
 *
 * Cada etapa que pede uma atividade gera a tarefa com o prazo combinado. Quando
 * o prospect sai da etapa, a tarefa dela é concluída: se ele foi de "a abordar"
 * para "abordado", abordar já foi feito, e deixar a tarefa aberta só polui a
 * agenda.
 *
 * Os prazos ficam aqui, num lugar só, para mudar sem caçar pelo código.
 */
export const PRAZOS = {
  abordarDias: 7,
  propostaDepoisDaReuniaoDias: 1, // "em até 24h" depois da reunião
  acompanharPropostaDias: 2, // "em até 48h"
  retomarNegociacaoDias: 2, // "em até 48h"
  duracaoReuniaoMin: 60,
} as const;

/** Etapas que não pedem tarefa: a próxima ação já está no próximo contato. */
const SEM_TAREFA: CicloCliente[] = ["ABORDADO", "RESPONDEU"];

/** Fora do funil de prospecção, todas as tarefas automáticas se encerram. */
const FIM_DO_FUNIL: CicloCliente[] = ["ATIVO", "PAUSADO", "ENCERRADO", "PERDIDO"];

type NovaTarefa = {
  chave: string;
  titulo: string;
  descricao?: string;
  prazo: Date;
  inicio?: Date;
  duracaoMin?: number;
};

function tarefasDaEtapa(etapa: CicloCliente, nome: string, reuniaoEm: Date | null): NovaTarefa[] {
  switch (etapa) {
    case "PROSPECCAO":
      return [
        {
          chave: "etapa:PROSPECCAO",
          titulo: `Abordar ${nome}`,
          descricao: "Primeiro contato. Registre na ficha do prospect quando fizer.",
          prazo: hojeComoDataPura(undefined, PRAZOS.abordarDias),
        },
      ];

    case "REUNIAO_MARCADA": {
      if (!reuniaoEm) {
        // Sem data não há reunião na agenda; a tarefa pede para marcar.
        return [
          {
            chave: "etapa:REUNIAO_MARCADA",
            titulo: `Definir data da reunião com ${nome}`,
            prazo: hojeComoDataPura(undefined, 1),
          },
        ];
      }
      const diaDaReuniao = dataPuraDe(reuniaoEm);
      const diaDaProposta = new Date(
        diaDaReuniao.getTime() + PRAZOS.propostaDepoisDaReuniaoDias * 24 * 60 * 60 * 1000,
      );
      return [
        {
          chave: "etapa:REUNIAO_MARCADA",
          titulo: `Reunião com ${nome}`,
          prazo: diaDaReuniao,
          inicio: reuniaoEm,
          duracaoMin: PRAZOS.duracaoReuniaoMin,
        },
        {
          chave: "etapa:REUNIAO_MARCADA:proposta",
          titulo: `Enviar proposta para ${nome}`,
          descricao: "Até 24h depois da reunião, enquanto a conversa está quente.",
          prazo: diaDaProposta,
        },
      ];
    }

    case "PROPOSTA_ENVIADA":
      return [
        {
          chave: "etapa:PROPOSTA_ENVIADA",
          titulo: `Acompanhar proposta de ${nome}`,
          descricao: "Confirmar se abriu e tirar dúvidas.",
          prazo: hojeComoDataPura(undefined, PRAZOS.acompanharPropostaDias),
        },
      ];

    case "NEGOCIANDO":
      return [
        {
          chave: "etapa:NEGOCIANDO",
          titulo: `Retomar negociação com ${nome}`,
          prazo: hojeComoDataPura(undefined, PRAZOS.retomarNegociacaoDias),
        },
      ];

    default:
      return [];
  }
}

/**
 * Chamada sempre que a etapa de um prospect muda — por você, pela proposta ou
 * pelo aceite. Idempotente: chamar duas vezes com a mesma etapa não duplica.
 */
export async function aoMudarEtapa(clienteId: string) {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { nome: true, ciclo: true, reuniaoEm: true },
  });
  if (!cliente) return;

  const novas = FIM_DO_FUNIL.includes(cliente.ciclo) || SEM_TAREFA.includes(cliente.ciclo)
    ? []
    : tarefasDaEtapa(cliente.ciclo, cliente.nome, cliente.reuniaoEm);
  const chavesNovas = novas.map((t) => t.chave);

  const abertas = await prisma.tarefa.findMany({
    where: { clienteId, automatica: true, status: "ABERTA", chave: { startsWith: "etapa:" } },
  });

  // Concluir as automáticas de etapas que ficaram para trás.
  const obsoletas = abertas.filter((t) => !chavesNovas.includes(t.chave ?? ""));
  if (obsoletas.length > 0) {
    await prisma.tarefa.updateMany({
      where: { id: { in: obsoletas.map((t) => t.id) } },
      data: { status: "FEITA", feitoEm: new Date() },
    });
  }

  for (const nova of novas) {
    const existente = abertas.find((t) => t.chave === nova.chave);
    if (existente) {
      // A reunião pode ter mudado de horário: a tarefa acompanha.
      if (nova.inicio && existente.inicio?.getTime() !== nova.inicio.getTime()) {
        await prisma.tarefa.update({
          where: { id: existente.id },
          data: { inicio: nova.inicio, prazo: nova.prazo, titulo: nova.titulo },
        });
      }
      continue;
    }

    await prisma.tarefa.create({
      data: {
        clienteId,
        automatica: true,
        chave: nova.chave,
        titulo: nova.titulo,
        descricao: nova.descricao ?? null,
        prazo: nova.prazo,
        inicio: nova.inicio ?? null,
        duracaoMin: nova.duracaoMin ?? null,
      },
    });
  }
}
