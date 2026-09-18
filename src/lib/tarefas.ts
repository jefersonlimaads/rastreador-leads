import "server-only";
import { prisma } from "./prisma";
import { inicioDoDia, fimDoDia, FUSO_PADRAO, formatarHora } from "./datas";

/**
 * Tarefas da operação. Sem cliente, é trabalho da jl.ads; com cliente, é
 * trabalho daquele cliente e aparece dentro do ambiente dele.
 *
 * A lista é organizada por urgência, não por data de criação: atrasada primeiro,
 * depois hoje, depois o resto. É assim que se olha tarefa em dia corrido.
 */

export type TarefaLista = {
  id: string;
  titulo: string;
  descricao: string | null;
  prazo: Date | null;
  status: string;
  clienteId: string | null;
  clienteNome: string | null;
  horario: string | null;
  automatica: boolean;
};

type Filtro = {
  /** null = só tarefas da jl.ads; string = só daquele cliente; undefined = todas. */
  clienteId?: string | null;
  incluirFeitas?: boolean;
};

export async function listarTarefas(filtro: Filtro = {}, fuso = FUSO_PADRAO) {
  const where: Record<string, unknown> = {};
  if (filtro.clienteId !== undefined) where.clienteId = filtro.clienteId;
  if (!filtro.incluirFeitas) where.status = "ABERTA";

  const tarefas = await prisma.tarefa.findMany({
    where,
    orderBy: [{ prazo: "asc" }, { inicio: "asc" }, { criadoEm: "desc" }],
    include: { cliente: { select: { nome: true } } },
    take: 200,
  });

  const lista: TarefaLista[] = tarefas.map((t) => ({
    id: t.id,
    titulo: t.titulo,
    descricao: t.descricao,
    prazo: t.prazo,
    status: t.status,
    clienteId: t.clienteId,
    clienteNome: t.cliente?.nome ?? null,
    horario: t.inicio ? formatarHora(t.inicio, fuso) : null,
    automatica: t.automatica,
  }));

  const inicio = inicioDoDia(new Date(), fuso);
  const fim = fimDoDia(new Date(), fuso);

  return {
    atrasadas: lista.filter((t) => t.status === "ABERTA" && t.prazo && t.prazo < inicio),
    hoje: lista.filter(
      (t) => t.status === "ABERTA" && t.prazo && t.prazo >= inicio && t.prazo <= fim,
    ),
    proximas: lista.filter((t) => t.status === "ABERTA" && t.prazo && t.prazo > fim),
    semPrazo: lista.filter((t) => t.status === "ABERTA" && !t.prazo),
    feitas: lista.filter((t) => t.status === "FEITA"),
  };
}

/** Contagem para os avisos do painel: o que está atrasado ou vence hoje. */
export async function tarefasUrgentes(clienteId?: string | null, fuso = FUSO_PADRAO) {
  const fim = fimDoDia(new Date(), fuso);
  const where: Record<string, unknown> = { status: "ABERTA", prazo: { lte: fim } };
  if (clienteId !== undefined) where.clienteId = clienteId;

  return prisma.tarefa.count({ where });
}
