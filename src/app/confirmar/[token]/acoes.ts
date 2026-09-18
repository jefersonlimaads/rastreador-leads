"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  clientePorToken,
  confirmarConversa,
  descartarClique,
  registrarDesfecho,
} from "@/lib/confirmacao";
import { normalizarTelefone } from "@/lib/telefone";
import { enfileirarEventoCapi } from "@/lib/meta/capi";

/**
 * Ações da página de confirmação. Não há sessão aqui: a autorização é o token,
 * e ele é conferido em toda ação. O cliente responde por si mesmo e nunca
 * alcança dados de outro cliente.
 */

const Base = z.object({ token: z.string().min(32).max(64) });

export type EstadoConfirmacao = { erro?: string; ok?: string };

async function clienteDaAcao(formData: FormData) {
  const dados = Base.safeParse({ token: String(formData.get("token") ?? "") });
  if (!dados.success) return null;
  return clientePorToken(dados.data.token);
}

function revalidar(token: string) {
  revalidatePath(`/confirmar/${token}`);
  revalidatePath("/carteira");
  revalidatePath("/hoje");
}

export async function acaoConfirmarConversa(
  _estado: EstadoConfirmacao,
  formData: FormData,
): Promise<EstadoConfirmacao> {
  const cliente = await clienteDaAcao(formData);
  if (!cliente) return { erro: "Link inválido ou expirado." };

  const cliqueId = String(formData.get("cliqueId") ?? "");
  const telefoneBruto = String(formData.get("telefone") ?? "").trim();
  const telefone = telefoneBruto ? (normalizarTelefone(telefoneBruto) ?? undefined) : undefined;

  const nome = String(formData.get("nome") ?? "").trim().slice(0, 120) || undefined;
  const lead = await confirmarConversa(cliente.id, cliqueId, telefone, nome);
  if (!lead) return { erro: "Esse item já foi respondido." };

  // O evento de lead para o Meta sai na confirmação, que é quando sabemos que a
  // mensagem existiu de verdade.
  await enfileirarEventoCapi({ leadId: lead.id, tipo: "LEAD" });

  revalidar(String(formData.get("token")));
  return { ok: "Anotado." };
}

export async function acaoDescartar(
  _estado: EstadoConfirmacao,
  formData: FormData,
): Promise<EstadoConfirmacao> {
  const cliente = await clienteDaAcao(formData);
  if (!cliente) return { erro: "Link inválido ou expirado." };

  const ok = await descartarClique(cliente.id, String(formData.get("cliqueId") ?? ""));
  if (!ok) return { erro: "Esse item já foi respondido." };

  revalidar(String(formData.get("token")));
  return { ok: "Anotado." };
}

export async function acaoDesfecho(
  _estado: EstadoConfirmacao,
  formData: FormData,
): Promise<EstadoConfirmacao> {
  const cliente = await clienteDaAcao(formData);
  if (!cliente) return { erro: "Link inválido ou expirado." };

  const status = String(formData.get("status") ?? "") as "FECHADO" | "PERDIDO";
  if (status !== "FECHADO" && status !== "PERDIDO") return { erro: "Resposta inválida." };

  const valorBruto = String(formData.get("valorVenda") ?? "")
    .replace(/\./g, "")
    .replace(",", ".");
  const valorVenda = valorBruto ? Number(valorBruto) : undefined;

  if (status === "FECHADO" && (!valorVenda || Number.isNaN(valorVenda) || valorVenda <= 0)) {
    return { erro: "Informe o valor da venda." };
  }

  const lead = await registrarDesfecho({
    clienteId: cliente.id,
    leadId: String(formData.get("leadId") ?? ""),
    status,
    valorVenda,
    motivoPerda: String(formData.get("motivoPerda") ?? ""),
  });
  if (!lead) return { erro: "Não consegui registrar. Confira os campos." };

  if (status === "FECHADO") {
    await enfileirarEventoCapi({ leadId: lead.id, tipo: "PURCHASE", valor: valorVenda });
  }

  revalidar(String(formData.get("token")));
  return { ok: status === "FECHADO" ? "Venda registrada." : "Anotado." };
}
