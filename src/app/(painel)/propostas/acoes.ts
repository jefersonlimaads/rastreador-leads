"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirAdmin, clienteDaAgencia } from "@/lib/auth";
import {
  alternarNegociacao,
  escopoDoTexto,
  excluirProposta,
  gerarToken,
  marcarEnviada,
  propostaDaAgencia,
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
  extras: z.string().max(6000).optional(),
  feeCheio: z.string().optional(),
  feeMensal: z.string().optional(),
  setupCheio: z.string().optional(),
  setup: z.string().optional(),
  meses: z.string().optional(),
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
  const sessao = await exigirAdmin();

  const dados = Dados.safeParse(Object.fromEntries(formData));
  if (!dados.success) return { erro: "Preencha título e validade." };
  const d = dados.data;
  const marcados = formData.getAll("servicos").map(String).filter(Boolean);

  let clienteId = d.clienteId || null;
  if (clienteId && !(await clienteDaAgencia(clienteId, sessao.agenciaId))) {
    return { erro: "Cliente inválido." };
  }
  if (!clienteId) {
    const nome = d.novoProspect?.trim();
    if (!nome) return { erro: "Escolha para quem é a proposta, ou digite o nome do prospect." };
    // Já nasce com proposta a caminho: vai direto para reunião marcada, sem
    // gerar a tarefa de abordar quem você já abordou.
    const novo = await prisma.cliente.create({
      data: { agenciaId: sessao.agenciaId, nome, ciclo: "REUNIAO_MARCADA" },
    });
    clienteId = novo.id;
  }

  const fee = d.feeMensal ? dinheiro(d.feeMensal) : null;
  const feeCheio = d.feeCheio ? dinheiro(d.feeCheio) : null;
  const setup = d.setup ? dinheiro(d.setup) : null;
  const setupCheio = d.setupCheio ? dinheiro(d.setupCheio) : null;
  if (d.feeMensal && fee === null) return { erro: "Valor mensal inválido." };
  if (d.feeCheio && feeCheio === null) return { erro: "Valor mensal de tabela inválido." };
  if (d.setup && setup === null) return { erro: "Valor de implantação inválido." };
  if (d.setupCheio && setupCheio === null) return { erro: "Implantação de tabela inválida." };
  // Preço de tabela abaixo do cobrado viraria "desconto negativo" na proposta.
  if (feeCheio != null && fee != null && feeCheio < fee) {
    return { erro: "O valor de tabela não pode ser menor que o valor desta proposta." };
  }
  if (setupCheio != null && setup != null && setupCheio < setup) {
    return { erro: "A implantação de tabela não pode ser menor que a desta proposta." };
  }

  const meses = d.meses ? Number(d.meses) : null;
  if (meses !== null && (Number.isNaN(meses) || meses < 1 || meses > 60)) {
    return { erro: "Período de contrato inválido." };
  }

  // Serviços marcados viram cópia; o catálogo pode mudar depois sem reescrever
  // o que já foi enviado.
  const doCatalogo = marcados.length
    ? await prisma.servicoProposta.findMany({
        where: { id: { in: marcados }, agenciaId: sessao.agenciaId },
        orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
        select: { id: true, nome: true, detalhe: true },
      })
    : [];

  const escopo = [
    ...doCatalogo.map((s) => ({
      titulo: s.nome,
      ...(s.detalhe ? { detalhe: s.detalhe } : {}),
      servicoId: s.id,
    })),
    ...escopoDoTexto(d.extras ?? ""),
  ];
  if (escopo.length === 0) return { erro: "Marque pelo menos um serviço." };

  const dadosProposta = {
    clienteId,
    titulo: d.titulo.trim(),
    apresentacao: d.apresentacao?.trim() || null,
    escopo,
    feeCheio,
    feeMensal: fee,
    setupCheio,
    setup,
    meses,
    condicoes: d.condicoes?.trim() || null,
    validade: new Date(d.validade + "T00:00:00Z"),
  };

  let id = d.propostaId;
  if (id) {
    const atual = await propostaDaAgencia(id, sessao.agenciaId);
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
  const sessao = await exigirAdmin();
  if (!(await propostaDaAgencia(propostaId, sessao.agenciaId))) throw new Error("Proposta não encontrada");
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
  const sessao = await exigirAdmin();
  const id = String(formData.get("propostaId") ?? "");
  if (!(await propostaDaAgencia(id, sessao.agenciaId))) return;
  await alternarNegociacao(id);
  revalidarPropostas(id);
}

/** Próximo contato e notas: o que faz a proposta não esfriar depois do envio. */
export async function acaoSalvarAcompanhamento(
  _estado: EstadoProposta,
  formData: FormData,
): Promise<EstadoProposta> {
  const sessao = await exigirAdmin();
  const id = String(formData.get("propostaId") ?? "");
  if (!(await propostaDaAgencia(id, sessao.agenciaId))) return { erro: "Proposta não encontrada." };
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
  const sessao = await exigirAdmin();
  const id = String(formData.get("propostaId") ?? "");
  if (!(await propostaDaAgencia(id, sessao.agenciaId))) return { erro: "Proposta não encontrada." };

  const r = await excluirProposta(id);
  if (r.erro) return { erro: r.erro };

  revalidarPropostas();
  redirect("/propostas");
}
