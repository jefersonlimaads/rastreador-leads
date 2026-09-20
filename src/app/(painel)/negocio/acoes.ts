"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizarContaAnuncios } from "@/lib/telefone";
import { exigirAdmin, clienteDaAgencia } from "@/lib/auth";
import { normalizarTelefone } from "@/lib/telefone";
import { competenciaDe, gerarFaturasDoMes } from "@/lib/financeiro";
import { aoMudarEtapa } from "@/lib/automacoes";
import { TIPOS_DE_ENTREGA } from "@/lib/entregas";
import { redirect } from "next/navigation";

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
  const sessao = await exigirAdmin();

  const dados = Comercial.safeParse(Object.fromEntries(formData));
  if (!dados.success) return { erro: "Confira os campos." };
  const d = dados.data;
  if (!(await clienteDaAgencia(d.clienteId, sessao.agenciaId))) return { erro: "Cliente inválido." };

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

  await aoMudarEtapa(d.clienteId);
  revalidatePath("/negocio");
  revalidatePath(`/negocio/${d.clienteId}`);
  revalidatePath("/tarefas");
  return { ok: "Salvo." };
}

/** Gera a fatura do mês para todos os ativos. A rotina diária faz o mesmo. */
export async function acaoGerarFaturas(): Promise<void> {
  const sessao = await exigirAdmin();
  await gerarFaturasDoMes(undefined, sessao.agenciaId);
  revalidatePath("/negocio");
}

/** Fatura avulsa, para cobrança fora do fee: projeto, taxa de setup, extra. */
export async function acaoCriarFatura(
  _estado: EstadoNegocio,
  formData: FormData,
): Promise<EstadoNegocio> {
  const sessao = await exigirAdmin();

  const clienteId = String(formData.get("clienteId") ?? "");
  if (!(await clienteDaAgencia(clienteId, sessao.agenciaId))) return { erro: "Cliente inválido." };
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
  const sessao = await exigirAdmin();
  const faturaId = String(formData.get("faturaId") ?? "");

  const fatura = await prisma.fatura.findFirst({
    where: { id: faturaId, cliente: { agenciaId: sessao.agenciaId } },
  });
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

const NovoClienteAtivo = z.object({
  nome: z.string().min(2).max(120),
  documento: z.string().max(20).optional(),
  numeroAtendimento: z.string().max(40).optional(),
  contatoNome: z.string().max(120).optional(),
  contatoTelefone: z.string().max(40).optional(),
  contatoEmail: z.string().max(160).optional(),
  feeMensal: z.string().optional(),
  diaVencimento: z.string().optional(),
  inicioContrato: z.string().optional(),
  funil: z.enum(["SIMPLES", "COMPLETO"]),
  conta: z.string().max(200).optional(),
  contaDigitada: z.string().max(60).optional(),
});

/**
 * Cliente que já existe antes do painel: entra direto como ativo, sem passar
 * pelo funil de prospecção. É o caso de toda agência que começa a usar o
 * sistema com a carteira que já tem.
 */
export async function acaoNovoClienteAtivo(
  _estado: EstadoNegocio,
  formData: FormData,
): Promise<EstadoNegocio> {
  const sessao = await exigirAdmin();

  const dados = NovoClienteAtivo.safeParse(Object.fromEntries(formData));
  if (!dados.success) return { erro: "Confira o nome do cliente e os campos preenchidos." };
  const d = dados.data;

  const fee = d.feeMensal ? dinheiro(d.feeMensal) : null;
  if (d.feeMensal && (fee === null || fee < 0)) return { erro: "Valor do fee inválido." };

  const dia = d.diaVencimento ? Number(d.diaVencimento) : null;
  if (dia !== null && (Number.isNaN(dia) || dia < 1 || dia > 28)) {
    return { erro: "O dia de vencimento vai de 1 a 28." };
  }
  if (fee && !dia) return { erro: "Com fee definido, informe o dia de vencimento." };

  // O número de atendimento é onde chegam os leads; o contato é quem decide e
  // paga. Costumam ser pessoas diferentes, por isso são campos diferentes.
  const atendimento = d.numeroAtendimento ? normalizarTelefone(d.numeroAtendimento) : null;
  if (d.numeroAtendimento && !atendimento) return { erro: "WhatsApp de atendimento inválido." };

  // Conta escolhida na lista ("act_123|Nome") ou digitada.
  const [escolhida, nomeConta] = (d.conta ?? "").split("|");
  const contaId = normalizarContaAnuncios(escolhida || d.contaDigitada);
  if (d.contaDigitada?.trim() && !escolhida && !contaId) return { erro: "Número da conta de anúncios inválido." };
  if (contaId) {
    const emUso = await prisma.contaAnuncios.findFirst({
      where: { contaId, cliente: { agenciaId: sessao.agenciaId } },
      select: { cliente: { select: { nome: true } } },
    });
    if (emUso) return { erro: `Essa conta de anúncios já está ligada a ${emUso.cliente.nome}.` };
  }

  const cliente = await prisma.cliente.create({
    data: {
      agenciaId: sessao.agenciaId,
      nome: d.nome.trim(),
      ciclo: "ATIVO",
      funil: d.funil,
      documento: d.documento?.trim() || null,
      contatoNome: d.contatoNome?.trim() || null,
      contatoTelefone: d.contatoTelefone ? normalizarTelefone(d.contatoTelefone) : null,
      contatoEmail: d.contatoEmail?.trim().toLowerCase() || null,
      feeMensal: fee,
      diaVencimento: dia,
      // Data pura: guardada em UTC para o dia não andar para trás.
      inicioContrato: d.inicioContrato ? new Date(d.inicioContrato + "T00:00:00Z") : null,
      ...(contaId ? { contas: { create: { contaId, nome: nomeConta?.trim() || null } } } : {}),
      ...(atendimento ? { numeros: { create: { numero: atendimento, rotulo: "Atendimento" } } } : {}),
    },
  });

  revalidatePath("/negocio");
  revalidatePath("/carteira");
  redirect(`/negocio/${cliente.id}`);
}

/**
 * Entrega do mês: o que a agência fez por esse cliente. Entra no relatório,
 * para responder ao "o que vocês fizeram esse mês?" com uma lista, e não com
 * uma tentativa de lembrar.
 */
export async function acaoRegistrarEntrega(
  _estado: EstadoNegocio,
  formData: FormData,
): Promise<EstadoNegocio> {
  const sessao = await exigirAdmin();
  const clienteId = String(formData.get("clienteId") ?? "");
  if (!(await clienteDaAgencia(clienteId, sessao.agenciaId))) return { erro: "Cliente inválido." };

  const tipo = String(formData.get("tipo") ?? "Outro");
  const descricao = String(formData.get("descricao") ?? "").trim().slice(0, 300);
  if (descricao.length < 3) return { erro: "Escreva o que foi entregue." };
  if (!(TIPOS_DE_ENTREGA as readonly string[]).includes(tipo)) return { erro: "Tipo inválido." };

  // Competência é o mês informado, ou o mês corrente.
  const mes = String(formData.get("competencia") ?? "").trim();
  const competencia = /^\d{4}-\d{2}$/.test(mes)
    ? new Date(`${mes}-01T00:00:00Z`)
    : (() => {
        const hoje = new Date();
        return new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
      })();

  await prisma.entrega.create({ data: { clienteId, tipo, descricao, competencia } });
  revalidatePath(`/negocio/${clienteId}`);
  revalidatePath("/relatorios");
  return { ok: "Entrega registrada." };
}

export async function acaoApagarEntrega(formData: FormData): Promise<void> {
  const sessao = await exigirAdmin();
  const id = String(formData.get("id") ?? "");
  const entrega = await prisma.entrega.findFirst({
    where: { id, cliente: { agenciaId: sessao.agenciaId } },
    select: { id: true, clienteId: true },
  });
  if (!entrega) return;
  await prisma.entrega.delete({ where: { id: entrega.id } });
  revalidatePath(`/negocio/${entrega.clienteId}`);
}
