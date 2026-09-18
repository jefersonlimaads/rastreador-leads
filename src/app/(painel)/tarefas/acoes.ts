"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/auth";

export type EstadoTarefa = { erro?: string; ok?: string };

const Nova = z.object({
  titulo: z.string().min(2).max(200),
  descricao: z.string().max(2000).optional(),
  prazo: z.string().optional(),
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
    clienteId: String(formData.get("clienteId") ?? ""),
  });
  if (!dados.success) return { erro: "Escreva o que precisa ser feito." };

  // Atendente e gestor só criam tarefa do próprio cliente.
  const clienteId = dados.data.clienteId || null;
  if (sessao.papel !== "ADMIN" && clienteId !== sessao.clienteId) {
    return { erro: "Sem acesso a esse cliente." };
  }

  await prisma.tarefa.create({
    data: {
      titulo: dados.data.titulo,
      descricao: dados.data.descricao || null,
      // Prazo é data pura: guardar em UTC evita o dia andar para trás.
      prazo: dados.data.prazo ? new Date(dados.data.prazo + "T00:00:00Z") : null,
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
