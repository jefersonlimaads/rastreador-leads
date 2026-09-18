import "server-only";
import { prisma } from "./prisma";
import { FUSO_PADRAO, instanteLocal, partesLocais } from "./datas";

/**
 * Tarefas organizadas por dia, para a agenda semanal e mensal.
 *
 * Tudo em datas puras (meia-noite UTC) para o dia, e instantes reais para o
 * horário: é o que evita a reunião das 22h aparecer no dia seguinte.
 */

export type ItemAgenda = {
  id: string;
  titulo: string;
  clienteId: string | null;
  clienteNome: string | null;
  clienteCiclo: string | null;
  status: string;
  automatica: boolean;
  /** Minutos desde a meia-noite local; nulo = dia inteiro. */
  inicioMin: number | null;
  duracaoMin: number;
  horario: string | null;
};

export type DiaAgenda = {
  chave: string; // "2026-09-18"
  data: Date; // data pura
  diaDoMes: number;
  diaSemana: number; // 0 = domingo
  hoje: boolean;
  foraDoMes?: boolean;
  diaInteiro: ItemAgenda[];
  comHorario: ItemAgenda[];
};

const DIA_MS = 24 * 60 * 60 * 1000;

export function chaveDoDia(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function dataPuraDaChave(chave: string) {
  return new Date(chave + "T00:00:00Z");
}

/** Segunda-feira da semana daquela data (a agenda começa na segunda). */
export function inicioDaSemana(dia: Date) {
  const semana = dia.getUTCDay(); // 0 = domingo
  const recuo = semana === 0 ? 6 : semana - 1;
  return new Date(dia.getTime() - recuo * DIA_MS);
}

async function tarefasNoIntervalo(de: Date, ate: Date, fuso: string) {
  // de/ate são datas puras; o intervalo em instantes cobre o dia inteiro local.
  const inicioInstante = instanteLocal(de.getUTCFullYear(), de.getUTCMonth() + 1, de.getUTCDate(), 0, 0, fuso);
  const fimInstante = instanteLocal(ate.getUTCFullYear(), ate.getUTCMonth() + 1, ate.getUTCDate() + 1, 0, 0, fuso);

  return prisma.tarefa.findMany({
    where: {
      OR: [
        { inicio: { gte: inicioInstante, lt: fimInstante } },
        { inicio: null, prazo: { gte: de, lte: ate } },
      ],
    },
    include: { cliente: { select: { nome: true, ciclo: true } } },
    orderBy: [{ inicio: "asc" }, { criadoEm: "asc" }],
  });
}

function montarDias(
  dias: Date[],
  tarefas: Awaited<ReturnType<typeof tarefasNoIntervalo>>,
  fuso: string,
  mesDeReferencia?: number,
): DiaAgenda[] {
  const hoje = partesLocais(new Date(), fuso);
  const chaveHoje = `${hoje.ano}-${String(hoje.mes).padStart(2, "0")}-${String(hoje.dia).padStart(2, "0")}`;

  const porDia = new Map<string, DiaAgenda>();
  for (const d of dias) {
    const chave = chaveDoDia(d);
    porDia.set(chave, {
      chave,
      data: d,
      diaDoMes: d.getUTCDate(),
      diaSemana: d.getUTCDay(),
      hoje: chave === chaveHoje,
      foraDoMes: mesDeReferencia !== undefined && d.getUTCMonth() !== mesDeReferencia,
      diaInteiro: [],
      comHorario: [],
    });
  }

  for (const t of tarefas) {
    const item: ItemAgenda = {
      id: t.id,
      titulo: t.titulo,
      clienteId: t.clienteId,
      clienteNome: t.cliente?.nome ?? null,
      clienteCiclo: t.cliente?.ciclo ?? null,
      status: t.status,
      automatica: t.automatica,
      inicioMin: null,
      duracaoMin: t.duracaoMin ?? 60,
      horario: null,
    };

    if (t.inicio) {
      const p = partesLocais(t.inicio, fuso);
      const chave = `${p.ano}-${String(p.mes).padStart(2, "0")}-${String(p.dia).padStart(2, "0")}`;
      item.inicioMin = p.hora * 60 + p.minuto;
      item.horario = `${String(p.hora).padStart(2, "0")}:${String(p.minuto).padStart(2, "0")}`;
      porDia.get(chave)?.comHorario.push(item);
    } else if (t.prazo) {
      porDia.get(chaveDoDia(t.prazo))?.diaInteiro.push(item);
    }
  }

  return [...porDia.values()];
}

export async function agendaDaSemana(dia: Date, fuso = FUSO_PADRAO) {
  const segunda = inicioDaSemana(dia);
  const dias = Array.from({ length: 7 }, (_, i) => new Date(segunda.getTime() + i * DIA_MS));
  const tarefas = await tarefasNoIntervalo(dias[0], dias[6], fuso);
  return { dias: montarDias(dias, tarefas, fuso), segunda };
}

/** Mês em seis semanas completas, como qualquer calendário de parede. */
export async function agendaDoMes(dia: Date, fuso = FUSO_PADRAO) {
  const primeiro = new Date(Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), 1));
  const comeco = inicioDaSemana(primeiro);
  const dias = Array.from({ length: 42 }, (_, i) => new Date(comeco.getTime() + i * DIA_MS));
  const tarefas = await tarefasNoIntervalo(dias[0], dias[41], fuso);
  return { dias: montarDias(dias, tarefas, fuso, primeiro.getUTCMonth()), primeiro };
}
