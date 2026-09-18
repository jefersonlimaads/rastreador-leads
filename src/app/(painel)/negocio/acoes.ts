"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirAdmin } from "@/lib/auth";
import { normalizarTelefone } from "@/lib/telefone";
import { competenciaDe, gerarFaturasDoMes } from "@/lib/financeiro";

/**
 * Tudo aqui é dado da jl.ads sobre o cliente — fee, vencimento, contrato — e
 * não dado do cliente. Por isso toda ação exige administrador.
 */

export type EstadoNegocio = { erro?: string; ok?: string };

function dinheiro(bruto: string): number | null {
  const limpo = bruto.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  if (!limpo) return null;
  const valor = Number(limpo);
  return Number.isNaN(valor) ? null : valor;
}

const Comercial = z.object({
  clienteId: z.string().min(1),
  ciclo: z.enum([
    "PROSPECCAO",
    "ABORDADO",
    "RESPONDEU",
    "REUNIAO_MARCADA",
    "PROPOSTA_ENVIADA",
    "NEGOCIANDO",
    "ATIVO",
    "PAUSADO",
    "ENCERRADO",
    "PERDIDO",
  ]),
  feeMensal: z.string().optional(),
  diaVencimento: z.string().optional(),
  inicioContrato: z.string().optional(),
  documento: z.string().max(20).optional(),
  contatoNome: z.string().max(120).optional(),
  contatoEmail: z.string().max(160).optional(),
  contatoTelefone: z.string().max(40).optional(),
  linkPagamento: z.string().max(500).optional(),
  observacoes: z.string().max(2000).optional(),
});

export async function acaoSalvarComercial(
  _estado: EstadoNegocio,
  formData: FormData,
): Promise<EstadoNegocio> {
  await exigirAdmin();

  const dados = Comercial.safeParse(Object.fromEntries(formData));
  if (!dados.success) return { erro: "Confira os campos." };
  const d = dados.data;

  const fee = d.feeMensal ? dinheiro(d.feeMensal) : null;
  if (d.feeMensal && fee === null) return { erro: "Valor do fee inválido." };

  const dia = d.diaVencimento ? Number(d.diaVencimento) : null;
  if (dia !== null && (Number.isNaN(dia) || dia < 1 || dia > 28)) {
    // Acima de 28 não existe em fevereiro, e fatura sem data é fatura esquecida.
    return { erro: "O dia de vencimento vai de 1 a 28." };
  }

  await prisma.cliente.update({
    where: { id: d.clienteId },
    data: {
      ciclo: d.ciclo,
      feeMensal: fee,
      diaVencimento: dia,
      inicioContrato: d.inicioContrato ? new Date(d.inicioContrato) : null,
      documento: d.documento?.trim() || null,
      contatoNome: d.contatoNome?.trim() || null,
      contatoEmail: d.contatoEmail?.trim().toLowerCase() || null,
      contatoTelefone: d.contatoTelefone ? normalizarTelefone(d.contatoTelefone) : null,
      linkPagamento: d.linkPagamento?.trim() || null,
      observacoes: d.observacoes?.trim() || null,
    },
  });

  revalidatePath("/negocio");
  revalidatePath(`/negocio/${d.clienteId}`);
  return { ok: "Salvo." };
}

/** Gera a fatura do mês para todos os ativos. A rotina diária faz o mesmo. */
export async function acaoGerarFaturas(): Promise<void> {
  await exigirAdmin();
  await gerarFaturasDoMes();
  revalidatePath("/negocio");
}

/** Fatura avulsa, para cobrança fora do fee: projeto, taxa de setup, extra. */
export async function acaoCriarFatura(
  _estado: EstadoNegocio,
  formData: FormData,
): Promise<EstadoNegocio> {
  await exigirAdmin();

  const clienteId = String(formData.get("clienteId") ?? "");
  const valor = dinheiro(String(formData.get("valor") ?? ""));
  const vencimento = String(formData.get("vencimento") ?? "");
  const observacao = String(formData.get("observacao") ?? "").trim();

  if (!valor || valor <= 0) return { erro: "Informe o valor." };
  if (!vencimento) return { erro: "Informe o vencimento." };

  const dataVencimento = new Date(vencimento + "T00:00:00Z");
  const competencia = competenciaDe(dataVencimento);

  const jaExiste = await prisma.fatura.findUnique({
    where: { clienteId_competencia: { clienteId, competencia } },
  });
  if (jaExiste) {
    return { erro: "Já existe fatura nesse mês para este cliente. Edite a que existe." };
  }

  await prisma.fatura.create({
    data: {
      clienteId,
      competencia,
      valor,
      vencimento: dataVencimento,
      observacao: observacao || null,
    },
  });

  revalidatePath(`/negocio/${clienteId}`);
  revalidatePath("/negocio");
  return { ok: "Fatura criada." };
}

export async function acaoMarcarPaga(formData: FormData): Promise<void> {
  await exigirAdmin();
  const faturaId = String(formData.get("faturaId") ?? "");

  const fatura = await prisma.fatura.findUnique({ where: { id: faturaId } });
  if (!fatura) return;

  // Clicar de novo desmarca: erro de toque no celular não vira trabalho.
  await prisma.fatura.update({
    where: { id: faturaId },
    data:
      fatura.status === "PAGA"
        ? { status: "ABERTA", pagoEm: null }
        : { status: "PAGA", pagoEm: new Date() },
  });

  revalidatePath("/negocio");
  revalidatePath(`/negocio/${fatura.clienteId}`);
}
