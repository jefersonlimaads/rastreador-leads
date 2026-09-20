"use server";

import { revalidatePath } from "next/cache";
import { exigirClienteDaAgencia, exigirSessao, podeVerDinheiro } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { criarLinkRelatorio, validarPeriodo } from "@/lib/relatorio";

export type EstadoRelatorio = { erro?: string; ok?: { url: string; id: string } };

async function exigirQuemRelata(clienteId: string) {
  const sessao = await exigirSessao();
  if (!podeVerDinheiro(sessao.papel)) throw new Error("Sem acesso a relatórios");
  await exigirClienteDaAgencia(clienteId, sessao);
  return sessao;
}

export async function acaoCriarRelatorio(
  _estado: EstadoRelatorio,
  formData: FormData,
): Promise<EstadoRelatorio> {
  const clienteId = String(formData.get("clienteId") ?? "");
  const sessao = await exigirQuemRelata(clienteId);

  const periodo = validarPeriodo(String(formData.get("de") ?? ""), String(formData.get("ate") ?? ""));
  if ("erro" in periodo) return { erro: periodo.erro };

  const comentario = String(formData.get("comentario") ?? "").trim().slice(0, 3000) || null;
  // Link vivo: o cliente guarda o link e sempre vê os últimos N dias.
  const vivo = String(formData.get("vivo") ?? "") === "1";
  const dias = Math.round((periodo.ate.getTime() - periodo.de.getTime()) / 86_400_000) + 1;
  const rel = await criarLinkRelatorio({
    clienteId,
    de: periodo.de,
    ate: periodo.ate,
    comentario,
    criadoPor: sessao.nome,
    diasMoveis: vivo ? dias : null,
  });

  revalidatePath("/relatorios");
  return { ok: { id: rel.id, url: `${process.env.APP_URL ?? ""}/relatorio/${rel.token}` } };
}

/** Apagar derruba o link: quem abrir depois vê "não encontrado". */
export async function acaoApagarRelatorio(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const rel = await prisma.relatorio.findUnique({ where: { id }, select: { clienteId: true } });
  if (!rel) return;
  await exigirQuemRelata(rel.clienteId);
  await prisma.relatorio.delete({ where: { id } });
  revalidatePath("/relatorios");
}
