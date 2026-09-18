"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirAdmin } from "@/lib/auth";
import {
  alternarNegociacao,
  escopoDoTexto,
  excluirProposta,
  gerarToken,
  marcarEnviada,
} from "@/lib/propostas";

export type EstadoProposta = { erro?: string; ok?: string };

function dinheiro(bruto: string): number | null {
  const limpo = bruto.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  if (!limpo) return null;
  const valor = Number(limpo);
  return Number.isNaN(valor) ? null : valor;
}

const Dados = z.object({
  propostaId: z.string().optional(),
  clienteId: z.string().optional(),
  novoProspect: z.string().max(120).optional(),
  titulo: z.string().min(3).max(160),
  apresentacao: z.string().max(3000).optional(),
  escopo: z.string().min(3).max(6000),
  feeMensal: z.string().optional(),
  setup: z.string().optional(),
  condicoes: z.string().max(3000).optional(),
  validade: z.string().min(10),
});

/**
 * Cria ou edita. Quando o prospect ainda não existe, nasce aqui mesmo como
 * cliente em prospecção — é a mesma empresa que depois vira ativa.
 */
export async function acaoSalvarProposta(
  _estado: EstadoProposta,
  formData: FormData,
): Promise<EstadoProposta> {
  await exigirAdmin();

  const dados = Dados.safeParse(Object.fromEntries(formData));
  if (!dados.success) return { erro: "Preencha título, escopo e validade." };
  const d = dados.data;

  let clienteId = d.clienteId || null;
  if (!clienteId) {
    const nome = d.novoProspect?.trim();
    if (!nome) return { erro: "Escolha para quem é a proposta, ou digite o nome do prospect." };
    const novo = await prisma.cliente.create({ data: { nome, ciclo: "PROSPECCAO" } });
    clienteId = novo.id;
  }

  const fee = d.feeMensal ? dinheiro(d.feeMensal) : null;
  const setup = d.setup ? dinheiro(d.setup) : null;
  if (d.feeMensal && fee === null) return { erro: "Valor mensal inválido." };
  if (d.setup && setup === null) return { erro: "Valor de implantação inválido." };

  const escopo = escopoDoTexto(d.escopo);
  if (escopo.length === 0) return { erro: "Descreva pelo menos um item do escopo." };

  const dadosProposta = {
    clienteId,
    titulo: d.titulo.trim(),
    apresentacao: d.apresentacao?.trim() || null,
    escopo,
    feeMensal: fee,
    setup,
    condicoes: d.condicoes?.trim() || null,
    validade: new Date(d.validade + "T00:00:00Z"),
  };

  let id = d.propostaId;
  if (id) {
    const atual = await prisma.proposta.findUnique({ where: { id } });
    if (!atual) return { erro: "Proposta não encontrada." };
    // Proposta respondida é registro do que foi combinado: não se reescreve.
    if (atual.status === "ACEITA" || atual.status === "RECUSADA") {
      return { erro: "Proposta já respondida não pode ser editada. Crie uma nova." };
    }
    await prisma.proposta.update({ where: { id }, data: dadosProposta });
  } else {
    const criada = await prisma.proposta.create({
      data: { ...dadosProposta, token: gerarToken() },
    });
    id = criada.id;
  }

  revalidatePath("/propostas");
  revalidatePath("/negocio");
  redirect(`/propostas/${id}`);
}

/** Marca como enviada e devolve o link para mandar ao lead. */
export async function acaoEnviarProposta(propostaId: string): Promise<string> {
  await exigirAdmin();
  const proposta = await marcarEnviada(propostaId);
  if (!proposta) throw new Error("Proposta não encontrada");

  revalidatePath("/propostas");
  revalidatePath(`/propostas/${propostaId}`);
  revalidatePath("/negocio");
  return `${process.env.APP_URL ?? ""}/proposta/${proposta.token}`;
}

function revalidarPropostas(id?: string) {
  revalidatePath("/propostas");
  revalidatePath("/negocio");
  if (id) revalidatePath(`/propostas/${id}`);
}

export async function acaoAlternarNegociacao(formData: FormData): Promise<void> {
  await exigirAdmin();
  const id = String(formData.get("propostaId") ?? "");
  await alternarNegociacao(id);
  revalidarPropostas(id);
}

/** Próximo contato e notas: o que faz a proposta não esfriar depois do envio. */
export async function acaoSalvarAcompanhamento(
  _estado: EstadoProposta,
  formData: FormData,
): Promise<EstadoProposta> {
  await exigirAdmin();
  const id = String(formData.get("propostaId") ?? "");
  const proximo = String(formData.get("proximoContato") ?? "");
  const notas = String(formData.get("notas") ?? "").trim().slice(0, 4000);

  await prisma.proposta.update({
    where: { id },
    data: {
      proximoContato: proximo ? new Date(proximo + "T00:00:00Z") : null,
      notas: notas || null,
    },
  });

  revalidarPropostas(id);
  return { ok: "Acompanhamento salvo." };
}

export async function acaoExcluirProposta(
  _estado: EstadoProposta,
  formData: FormData,
): Promise<EstadoProposta> {
  await exigirAdmin();
  const id = String(formData.get("propostaId") ?? "");

  const r = await excluirProposta(id);
  if (r.erro) return { erro: r.erro };

  revalidarPropostas();
  redirect("/propostas");
}
