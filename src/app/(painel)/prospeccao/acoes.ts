"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirAdmin, clienteDaAgencia, type Sessao } from "@/lib/auth";
import { normalizarTelefone } from "@/lib/telefone";
import { excluirProspect, marcarPerdido, reativarProspect, registrarInteracao } from "@/lib/prospeccao";
import { aoMudarEtapa } from "@/lib/automacoes";
import type { CicloCliente, TipoInteracao } from "@prisma/client";

export type EstadoProspeccao = { erro?: string; ok?: string };

/** Toda ação daqui recebe um id de prospect: ele tem que ser desta agência. */
async function prospectDaAgencia(formData: FormData, sessao: Sessao) {
  const id = String(formData.get("clienteId") ?? "");
  return (await clienteDaAgencia(id, sessao.agenciaId)) ? id : null;
}

function revalidar(id?: string) {
  revalidatePath("/prospeccao");
  revalidatePath("/negocio");
  if (id) revalidatePath(`/prospeccao/${id}`);
}

function dataPura(bruto: string | null | undefined) {
  return bruto ? new Date(bruto + "T00:00:00Z") : null;
}

/** Cadastro rápido: nome e de onde veio bastam para começar. */
export async function acaoNovoProspect(
  _estado: EstadoProspeccao,
  formData: FormData,
): Promise<EstadoProspeccao> {
  const sessao = await exigirAdmin();

  const nome = String(formData.get("nome") ?? "").trim();
  if (nome.length < 2) return { erro: "Escreva o nome do prospect." };

  const telefone = String(formData.get("contatoTelefone") ?? "").trim();
  const criado = await prisma.cliente.create({
    data: {
      agenciaId: sessao.agenciaId,
      nome,
      ciclo: "PROSPECCAO",
      nicho: String(formData.get("nicho") ?? "").trim() || null,
      origem: String(formData.get("origem") ?? "").trim() || null,
      contatoTelefone: telefone ? normalizarTelefone(telefone) : null,
      // Prospect novo já nasce com contato para hoje: senão fica na lista esquecido.
      proximoContato: dataPura(new Date().toISOString().slice(0, 10)),
    },
  });

  await aoMudarEtapa(criado.id);
  revalidar();
  revalidatePath("/tarefas");
  redirect(`/prospeccao/${criado.id}`);
}

const Dados = z.object({
  clienteId: z.string().min(1),
  nome: z.string().min(2).max(120),
  nicho: z.string().max(80).optional(),
  origem: z.string().max(60).optional(),
  contatoNome: z.string().max(120).optional(),
  contatoTelefone: z.string().max(40).optional(),
  contatoEmail: z.string().max(160).optional(),
  instagram: z.string().max(120).optional(),
  site: z.string().max(300).optional(),
  observacoes: z.string().max(3000).optional(),
});

export async function acaoSalvarProspect(
  _estado: EstadoProspeccao,
  formData: FormData,
): Promise<EstadoProspeccao> {
  const sessao = await exigirAdmin();
  const dados = Dados.safeParse(Object.fromEntries(formData));
  if (!dados.success) return { erro: "Confira os campos." };
  const d = dados.data;
  if (!(await prospectDaAgencia(formData, sessao))) return { erro: "Prospect não encontrado." };

  await prisma.cliente.update({
    where: { id: d.clienteId },
    data: {
      nome: d.nome.trim(),
      nicho: d.nicho?.trim() || null,
      origem: d.origem?.trim() || null,
      contatoNome: d.contatoNome?.trim() || null,
      contatoTelefone: d.contatoTelefone ? normalizarTelefone(d.contatoTelefone) : null,
      contatoEmail: d.contatoEmail?.trim().toLowerCase() || null,
      instagram: d.instagram?.trim().replace(/^@/, "") || null,
      site: d.site?.trim() || null,
      observacoes: d.observacoes?.trim() || null,
    },
  });

  revalidar(d.clienteId);
  return { ok: "Salvo." };
}

export async function acaoRegistrarInteracao(
  _estado: EstadoProspeccao,
  formData: FormData,
): Promise<EstadoProspeccao> {
  const sessao = await exigirAdmin();

  const clienteId = await prospectDaAgencia(formData, sessao);
  if (!clienteId) return { erro: "Prospect não encontrado." };
  const descricao = String(formData.get("descricao") ?? "").trim();
  if (descricao.length < 3) return { erro: "Anote o que foi dito, mesmo que curto." };

  const etapa = String(formData.get("novaEtapa") ?? "");
  const proximo = String(formData.get("proximoContato") ?? "");
  const reuniao = String(formData.get("reuniaoEm") ?? "");

  if (etapa === "REUNIAO_MARCADA" && !reuniao) {
    return { erro: "Informe o dia e o horário da reunião: é o que vai para a agenda." };
  }
  const reuniaoEm = reuniao ? new Date(reuniao) : null;
  if (reuniaoEm && Number.isNaN(reuniaoEm.getTime())) return { erro: "Horário da reunião inválido." };

  await registrarInteracao({
    clienteId,
    tipo: String(formData.get("tipo") ?? "MENSAGEM") as TipoInteracao,
    descricao: descricao.slice(0, 2000),
    novaEtapa: (etapa || null) as CicloCliente | null,
    proximoContato: dataPura(proximo),
    reuniaoEm,
  });

  revalidar(clienteId);
  revalidatePath("/tarefas");
  return { ok: "Registrado." };
}

export async function acaoMarcarPerdido(
  _estado: EstadoProspeccao,
  formData: FormData,
): Promise<EstadoProspeccao> {
  const sessao = await exigirAdmin();
  const clienteId = await prospectDaAgencia(formData, sessao);
  if (!clienteId) return { erro: "Prospect não encontrado." };
  const r = await marcarPerdido(clienteId, String(formData.get("motivo") ?? ""));
  if (r.erro) return { erro: r.erro };
  revalidar(clienteId);
  return { ok: "Marcado como perdido." };
}

export async function acaoReativar(formData: FormData): Promise<void> {
  const sessao = await exigirAdmin();
  const clienteId = await prospectDaAgencia(formData, sessao);
  if (!clienteId) return;
  await reativarProspect(clienteId);
  revalidar(clienteId);
}

export async function acaoExcluirProspect(
  _estado: EstadoProspeccao,
  formData: FormData,
): Promise<EstadoProspeccao> {
  const sessao = await exigirAdmin();
  const clienteId = await prospectDaAgencia(formData, sessao);
  if (!clienteId) return { erro: "Prospect não encontrado." };
  const r = await excluirProspect(clienteId);
  if (r.erro) return { erro: r.erro };
  revalidar();
  redirect("/prospeccao");
}
