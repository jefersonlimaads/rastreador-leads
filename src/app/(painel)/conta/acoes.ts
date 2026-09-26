"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/auth";
import { gerarChaveImportacao, revogarChaveImportacao } from "@/lib/pesquisa/importacao";
import { definirAcesso } from "@/lib/acesso";

export type EstadoChave = { chave?: string; erro?: string };

/** Gera (ou troca) a chave de importação. A antiga para de funcionar na hora. */
export async function acaoGerarChaveImportacao(_estado: EstadoChave): Promise<EstadoChave> {
  const sessao = await exigirAdmin();
  const chave = await gerarChaveImportacao(sessao.agenciaId);
  revalidatePath("/conta");
  return { chave };
}

export async function acaoRevogarChaveImportacao(): Promise<void> {
  const sessao = await exigirAdmin();
  await revogarChaveImportacao(sessao.agenciaId);
  revalidatePath("/conta");
}

/**
 * Quais clientes um colaborador alcança. Nenhum marcado devolve o acesso a
 * todos: restringir é ato explícito, e o padrão não pode trancar ninguém para
 * fora sem alguém ter pedido.
 */
export async function acaoDefinirAcesso(formData: FormData): Promise<void> {
  const sessao = await exigirAdmin();
  const usuarioId = String(formData.get("usuarioId") ?? "");
  const clienteIds = formData.getAll("clientes").map(String).filter(Boolean);

  await definirAcesso({ agenciaId: sessao.agenciaId, usuarioId, clienteIds });
  revalidatePath("/conta");
}
