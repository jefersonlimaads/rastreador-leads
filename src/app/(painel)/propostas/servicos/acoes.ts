"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/auth";
import { alternarServico, criarServico, excluirServico } from "@/lib/servicos";

export type EstadoServico = { erro?: string; ok?: string };

function revalidar() {
  revalidatePath("/propostas/servicos");
  revalidatePath("/propostas/nova");
}

export async function acaoCriarServico(
  _estado: EstadoServico,
  formData: FormData,
): Promise<EstadoServico> {
  const sessao = await exigirAdmin();
  const nome = String(formData.get("nome") ?? "").trim().slice(0, 160);
  const detalhe = String(formData.get("detalhe") ?? "").trim().slice(0, 300);
  if (nome.length < 3) return { erro: "Escreva o nome do serviço." };

  await criarServico(sessao.agenciaId, nome, detalhe || null);
  revalidar();
  return { ok: "Serviço adicionado." };
}

export async function acaoAlternarServico(formData: FormData): Promise<void> {
  const sessao = await exigirAdmin();
  await alternarServico(sessao.agenciaId, String(formData.get("id") ?? ""));
  revalidar();
}

export async function acaoExcluirServico(formData: FormData): Promise<void> {
  const sessao = await exigirAdmin();
  await excluirServico(sessao.agenciaId, String(formData.get("id") ?? ""));
  revalidar();
}
