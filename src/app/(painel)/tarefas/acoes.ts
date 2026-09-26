"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessao, clienteDaAgencia } from "@/lib/auth";
import { dataPuraDe } from "@/lib/datas";
import { DIAS_DA_RECORRENCIA, proximaOcorrencia } from "@/lib/regras";

export type EstadoTarefa = { erro?: string; ok?: string };

const Nova = z.object({
  titulo: z.string().min(2).max(200),
  descricao: z.string().max(2000).optional(),
  prazo: z.string().optional(),
  inicio: z.string().optional(),
  duracaoMin: z.string().optional(),
  clienteId: z.string().optional(),
  prioridade: z.string().optional(),
  recorrencia: z.string().optional(),
});


export async function acaoCriarTarefa(
  _estado: EstadoTarefa,
  formData: FormData,
): Promise<EstadoTarefa> {
  const sessao = await exigirSessao();

  const dados = Nova.safeParse({
    titulo: String(formData.get("titulo") ?? "").trim(),
    descricao: String(formData.get("descricao") ?? "").trim(),
    prazo: String(formData.get("prazo") ?? ""),
    inicio: String(formData.get("inicio") ?? ""),
    duracaoMin: String(formData.get("duracaoMin") ?? ""),
    clienteId: String(formData.get("clienteId") ?? ""),
    prioridade: String(formData.get("prioridade") ?? ""),
    recorrencia: String(formData.get("recorrencia") ?? ""),
  });
  if (!dados.success) return { erro: "Escreva o que precisa ser feito." };

  // Atendente e gestor só criam tarefa do próprio cliente; ninguém cria em
  // cliente de outra agência.
  const clienteId = dados.data.clienteId || null;
  if (sessao.papel !== "ADMIN" && clienteId !== sessao.clienteId) {
    return { erro: "Sem acesso a esse cliente." };
  }
  if (clienteId && !(await clienteDaAgencia(clienteId, sessao.agenciaId))) {
    return { erro: "Sem acesso a esse cliente." };
  }

  const inicio = dados.data.inicio ? new Date(dados.data.inicio) : null;
  if (inicio && Number.isNaN(inicio.getTime())) return { erro: "Horário inválido." };
  const duracao = dados.data.duracaoMin ? Number(dados.data.duracaoMin) : null;

  await prisma.tarefa.create({
    data: {
      agenciaId: sessao.agenciaId,
      titulo: dados.data.titulo,
      descricao: dados.data.descricao || null,
      // Com horário, o dia da tarefa é o dia desse horário em São Paulo.
      // Sem, é data pura: guardar em UTC evita o dia andar para trás.
      prazo: inicio
        ? dataPuraDe(inicio)
        : dados.data.prazo
          ? new Date(dados.data.prazo + "T00:00:00Z")
          : null,
      inicio,
      duracaoMin: inicio ? (duracao ?? 60) : null,
      clienteId,
      prioridade: dados.data.prioridade === "1" ? 1 : 0,
      recorrencia: DIAS_DA_RECORRENCIA[dados.data.recorrencia ?? ""] ? dados.data.recorrencia! : null,
      criadoPorId: sessao.usuarioId,
    },
  });

  revalidatePath("/tarefas");
  revalidatePath("/hoje");
  return { ok: "Anotado." };
}

/** Concluir e reabrir são o mesmo botão. */
/**
 * Concluir tarefa que se repete cria a próxima na hora.
 *
 * A alternativa seria uma rotina diária varrendo tarefas — que cria a próxima
 * mesmo quando ninguém fez a atual, e o painel enche de cobranças repetidas.
 * Nascendo do "feito", a fila anda no ritmo de quem trabalha.
 */
async function repetir(tarefa: {
  id: string;
  agenciaId: string;
  clienteId: string | null;
  titulo: string;
  descricao: string | null;
  prazo: Date | null;
  prioridade: number;
  recorrencia: string | null;
  criadoPorId: string | null;
}) {
  const proximo = proximaOcorrencia(tarefa.prazo, tarefa.recorrencia);
  if (!proximo) return;

  await prisma.tarefa.create({
    data: {
      agenciaId: tarefa.agenciaId,
      clienteId: tarefa.clienteId,
      titulo: tarefa.titulo,
      descricao: tarefa.descricao,
      prazo: dataPuraDe(proximo),
      prioridade: tarefa.prioridade,
      recorrencia: tarefa.recorrencia,
      criadoPorId: tarefa.criadoPorId,
    },
  });
}

export async function acaoAlternarTarefa(formData: FormData): Promise<void> {
  const sessao = await exigirSessao();
  const id = String(formData.get("tarefaId") ?? "");

  const tarefa = await prisma.tarefa.findFirst({ where: { id, agenciaId: sessao.agenciaId } });
  if (!tarefa) return;
  if (sessao.papel !== "ADMIN" && tarefa.clienteId !== sessao.clienteId) return;

  const concluindo = tarefa.status !== "FEITA";
  await prisma.tarefa.update({
    where: { id },
    data: concluindo
      ? { status: "FEITA", feitoEm: new Date() }
      : { status: "ABERTA", feitoEm: null },
  });

  if (concluindo && tarefa.recorrencia) await repetir(tarefa);

  revalidatePath("/tarefas");
  revalidatePath("/hoje");
}

export async function acaoApagarTarefa(formData: FormData): Promise<void> {
  const sessao = await exigirSessao();
  const id = String(formData.get("tarefaId") ?? "");

  const tarefa = await prisma.tarefa.findFirst({ where: { id, agenciaId: sessao.agenciaId } });
  if (!tarefa) return;
  if (sessao.papel !== "ADMIN" && tarefa.clienteId !== sessao.clienteId) return;

  // Tarefa é anotação de trabalho, não histórico de lead: apagar é apagar.
  await prisma.tarefa.delete({ where: { id } });
  revalidatePath("/tarefas");
  revalidatePath("/hoje");
}
