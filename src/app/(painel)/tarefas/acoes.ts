"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/auth";
import { dataPuraDe } from "@/lib/datas";

export type EstadoTarefa = { erro?: string; ok?: string };

const Nova = z.object({
  titulo: z.string().min(2).max(200),
  descricao: z.string().max(2000).optional(),
  prazo: z.string().optional(),
  inicio: z.string().optional(),
  duracaoMin: z.string().optional(),
  clienteId: z.string().optional(),
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
  });
  if (!dados.success) return { erro: "Escreva o que precisa ser feito." };

  // Atendente e gestor só criam tarefa do próprio cliente.
  const clienteId = dados.data.clienteId || null;
  if (sessao.papel !== "ADMIN" && clienteId !== sessao.clienteId) {
    return { erro: "Sem acesso a esse cliente." };
  }

  const inicio = dados.data.inicio ? new Date(dados.data.inicio) : null;
  if (inicio && Number.isNaN(inicio.getTime())) return { erro: "Horário inválido." };
  const duracao = dados.data.duracaoMin ? Number(dados.data.duracaoMin) : null;

  await prisma.tarefa.create({
    data: {
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
      criadoPorId: sessao.usuarioId,
    },
  });

  revalidatePath("/tarefas");
  revalidatePath("/hoje");
  return { ok: "Anotado." };
}

/** Concluir e reabrir são o mesmo botão. */
export async function acaoAlternarTarefa(formData: FormData): Promise<void> {
  const sessao = await exigirSessao();
  const id = String(formData.get("tarefaId") ?? "");

  const tarefa = await prisma.tarefa.findUnique({ where: { id } });
  if (!tarefa) return;
  if (sessao.papel !== "ADMIN" && tarefa.clienteId !== sessao.clienteId) return;

  await prisma.tarefa.update({
    where: { id },
    data:
      tarefa.status === "FEITA"
        ? { status: "ABERTA", feitoEm: null }
        : { status: "FEITA", feitoEm: new Date() },
  });

  revalidatePath("/tarefas");
  revalidatePath("/hoje");
}

export async function acaoApagarTarefa(formData: FormData): Promise<void> {
  const sessao = await exigirSessao();
  const id = String(formData.get("tarefaId") ?? "");

  const tarefa = await prisma.tarefa.findUnique({ where: { id } });
  if (!tarefa) return;
  if (sessao.papel !== "ADMIN" && tarefa.clienteId !== sessao.clienteId) return;

  // Tarefa é anotação de trabalho, não histórico de lead: apagar é apagar.
  await prisma.tarefa.delete({ where: { id } });
  revalidatePath("/tarefas");
  revalidatePath("/hoje");
}
