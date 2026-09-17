"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessao, clienteEmFoco, podeVerDinheiro, type Sessao } from "@/lib/auth";
import { cadastrarLead, sugerirClique } from "@/lib/atribuicao";
import { normalizarTelefone } from "@/lib/telefone";
import { enfileirarEventoCapi } from "@/lib/meta/capi";
import type { StatusLead } from "@prisma/client";

/**
 * Nenhuma ação confia no clienteId que vem do formulário: ele é sempre conferido
 * contra a sessão. É isso que garante que um cliente não mexa no lead de outro.
 */
async function leadPermitido(leadId: string, sessao: Sessao) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead não encontrado");
  if (sessao.papel !== "ADMIN" && lead.clienteId !== sessao.clienteId) {
    throw new Error("Sem acesso a este lead");
  }
  return lead;
}

function revalidarPainel(leadId?: string) {
  revalidatePath("/hoje");
  revalidatePath("/pipeline");
  revalidatePath("/leads");
  if (leadId) revalidatePath(`/leads/${leadId}`);
}

export type EstadoCadastro = { erro?: string; aviso?: string };

const Cadastro = z.object({
  clienteId: z.string().min(1),
  telefone: z.string().min(8),
  nome: z.string().max(120).optional(),
  mensagem: z.string().max(2000).optional(),
  codigo: z.string().max(12).optional(),
  mensagemEm: z.string().optional(),
  cliqueId: z.string().optional(),
});

export async function acaoCadastrarLead(
  _estado: EstadoCadastro,
  formData: FormData,
): Promise<EstadoCadastro> {
  const sessao = await exigirSessao();

  const dados = Cadastro.safeParse({
    clienteId: String(formData.get("clienteId") ?? ""),
    telefone: String(formData.get("telefone") ?? ""),
    nome: String(formData.get("nome") ?? ""),
    mensagem: String(formData.get("mensagem") ?? ""),
    codigo: String(formData.get("codigo") ?? ""),
    mensagemEm: String(formData.get("mensagemEm") ?? ""),
    cliqueId: String(formData.get("cliqueId") ?? ""),
  });

  if (!dados.success) return { erro: "Confira os dados do lead." };

  const clienteId = await clienteEmFoco(sessao, dados.data.clienteId);
  if (!clienteId || (sessao.papel !== "ADMIN" && clienteId !== sessao.clienteId)) {
    return { erro: "Cliente inválido para este usuário." };
  }

  const telefone = normalizarTelefone(dados.data.telefone);
  if (!telefone) return { erro: "Telefone inválido. Use DDD + número." };

  // Horário da mensagem: o atendente pode ter cadastrado horas depois.
  const mensagemEm = dados.data.mensagemEm ? new Date(dados.data.mensagemEm) : new Date();
  if (Number.isNaN(mensagemEm.getTime())) return { erro: "Horário da mensagem inválido." };
  if (mensagemEm.getTime() > Date.now() + 60_000) {
    return { erro: "O horário da mensagem está no futuro." };
  }

  const resultado = await cadastrarLead({
    clienteId,
    telefone,
    nome: dados.data.nome,
    mensagem: dados.data.mensagem,
    codigoInformado: dados.data.codigo || null,
    mensagemEm,
    usuarioId: sessao.usuarioId,
    cliqueIdEscolhido: dados.data.cliqueId || null,
  });

  if (resultado.tipo === "criado" || resultado.tipo === "reaberto") {
    // Regra do escopo: o evento de lead sai quando o lead é cadastrado.
    await enfileirarEventoCapi({ leadId: resultado.lead.id, tipo: "LEAD" });
  }

  revalidarPainel(resultado.lead.id);

  if (resultado.tipo === "retorno") {
    return {
      aviso:
        "Esse telefone já era lead: registramos um retorno no lead existente, sem contar lead novo.",
    };
  }

  redirect(`/leads/${resultado.lead.id}`);
}

/** Prévia da atribuição na tela de cadastro, antes de salvar. */
export async function acaoPreverAtribuicao(params: {
  clienteId: string;
  mensagem?: string;
  codigo?: string;
  mensagemEm?: string;
}) {
  const sessao = await exigirSessao();
  const clienteId = await clienteEmFoco(sessao, params.clienteId);
  if (!clienteId) return null;

  const quando = params.mensagemEm ? new Date(params.mensagemEm) : new Date();
  const { clique, atribuicao, codigoLido } = await sugerirClique({
    clienteId,
    mensagem: params.mensagem,
    codigoInformado: params.codigo,
    mensagemEm: Number.isNaN(quando.getTime()) ? new Date() : quando,
  });

  return {
    atribuicao,
    codigoLido,
    clique: clique
      ? {
          id: clique.id,
          codigo: clique.codigo,
          adId: clique.adId,
          utmCampaign: clique.utmCampaign,
          criadoEm: clique.criadoEm.toISOString(),
        }
      : null,
  };
}

const MudancaStatus = z.object({
  leadId: z.string().min(1),
  status: z.enum(["NOVO", "EM_ATENDIMENTO", "ORCAMENTO_ENVIADO", "FECHADO", "PERDIDO"]),
  valorVenda: z.string().optional(),
  motivoPerda: z.string().max(300).optional(),
});

export type EstadoStatus = { erro?: string; ok?: boolean };

export async function acaoMudarStatus(
  _estado: EstadoStatus,
  formData: FormData,
): Promise<EstadoStatus> {
  const sessao = await exigirSessao();
  const dados = MudancaStatus.safeParse({
    leadId: String(formData.get("leadId") ?? ""),
    status: String(formData.get("status") ?? ""),
    valorVenda: String(formData.get("valorVenda") ?? ""),
    motivoPerda: String(formData.get("motivoPerda") ?? ""),
  });
  if (!dados.success) return { erro: "Status inválido." };

  const lead = await leadPermitido(dados.data.leadId, sessao);
  const status = dados.data.status as StatusLead;

  // Regra 7: fechado exige valor, perdido exige motivo.
  let valorVenda: number | null = lead.valorVenda ? Number(lead.valorVenda) : null;
  let motivoPerda = lead.motivoPerda;

  if (status === "FECHADO") {
    if (!podeVerDinheiro(sessao.papel)) {
      return { erro: "Só gestor ou admin pode fechar lead com valor." };
    }
    const bruto = (dados.data.valorVenda ?? "").replace(/\./g, "").replace(",", ".");
    const valor = Number(bruto);
    if (!bruto || Number.isNaN(valor) || valor <= 0) {
      return { erro: "Informe o valor da venda para fechar o lead." };
    }
    valorVenda = valor;
  }

  if (status === "PERDIDO") {
    if (!dados.data.motivoPerda?.trim()) {
      return { erro: "Informe o motivo da perda." };
    }
    motivoPerda = dados.data.motivoPerda.trim();
  }

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: lead.id },
      data: {
        status,
        valorVenda,
        motivoPerda,
        fechadoEm: status === "FECHADO" || status === "PERDIDO" ? new Date() : null,
      },
    });

    // Regra 11: toda mudança de status vira evento, com usuário e horário.
    await tx.evento.create({
      data: {
        clienteId: lead.clienteId,
        leadId: lead.id,
        tipo: "MUDANCA_STATUS",
        descricao:
          status === "FECHADO"
            ? `Fechado por R$ ${valorVenda?.toFixed(2)}`
            : status === "PERDIDO"
              ? `Perdido: ${motivoPerda}`
              : `Status: ${status}`,
        usuarioId: sessao.usuarioId,
      },
    });
  });

  if (status === "FECHADO") {
    await enfileirarEventoCapi({ leadId: lead.id, tipo: "PURCHASE", valor: valorVenda ?? undefined });
  }

  revalidarPainel(lead.id);
  return { ok: true };
}

export async function acaoRegistrarContato(formData: FormData) {
  const sessao = await exigirSessao();
  const leadId = String(formData.get("leadId") ?? "");
  const lead = await leadPermitido(leadId, sessao);

  await prisma.evento.create({
    data: {
      clienteId: lead.clienteId,
      leadId: lead.id,
      tipo: "CONTATO",
      descricao: "Contato registrado pelo painel",
      usuarioId: sessao.usuarioId,
    },
  });

  revalidarPainel(lead.id);
}

export async function acaoAdicionarNota(formData: FormData) {
  const sessao = await exigirSessao();
  const leadId = String(formData.get("leadId") ?? "");
  const texto = String(formData.get("nota") ?? "").trim();
  if (!texto) return;

  const lead = await leadPermitido(leadId, sessao);
  await prisma.evento.create({
    data: {
      clienteId: lead.clienteId,
      leadId: lead.id,
      tipo: "NOTA",
      descricao: texto.slice(0, 500),
      usuarioId: sessao.usuarioId,
    },
  });

  revalidarPainel(lead.id);
}
