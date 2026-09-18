"use server";

import { revalidatePath } from "next/cache";
import { aceitarProposta, recusarProposta } from "@/lib/propostas";

/**
 * Resposta do lead. Sem sessão: a autorização é o token do link, conferido em
 * aceitarProposta e recusarProposta.
 */
export type EstadoResposta = { erro?: string; ok?: "aceita" | "recusada" };

export async function acaoAceitar(
  _estado: EstadoResposta,
  formData: FormData,
): Promise<EstadoResposta> {
  const token = String(formData.get("token") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (nome.length < 3) return { erro: "Escreva seu nome para confirmar o aceite." };

  const r = await aceitarProposta(token, nome.slice(0, 120));
  if (r.erro) return { erro: r.erro };

  revalidatePath(`/proposta/${token}`);
  revalidatePath("/propostas");
  revalidatePath("/negocio");
  return { ok: "aceita" };
}

export async function acaoRecusar(
  _estado: EstadoResposta,
  formData: FormData,
): Promise<EstadoResposta> {
  const token = String(formData.get("token") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim().slice(0, 500);

  const r = await recusarProposta(token, motivo);
  if (r.erro) return { erro: r.erro };

  revalidatePath(`/proposta/${token}`);
  revalidatePath("/propostas");
  return { ok: "recusada" };
}
