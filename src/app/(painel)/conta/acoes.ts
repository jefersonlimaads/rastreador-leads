"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/auth";
import { gerarChaveImportacao, revogarChaveImportacao } from "@/lib/pesquisa/importacao";

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
