import "server-only";
import { prisma } from "./prisma";
import { gerarToken } from "./confirmacao";
import { hojeComoDataPura } from "./datas";
import { sincronizarCiclo } from "./prospeccao";
import { aoMudarEtapa } from "./automacoes";

/**
 * Propostas comerciais da jl.ads.
 *
 * O ciclo do prospect anda junto com a proposta: enviar coloca o cliente em
 * "proposta enviada", aceitar o torna ativo com o fee da proposta e abre a
 * tarefa de onboarding. Assim o Negócio nunca fica desatualizado em relação ao
 * que foi fechado.
 */

/**
 * Item do escopo. `servicoId` diz de qual serviço do catálogo ele veio, o que
 * permite remarcar as caixinhas certas ao editar. O título e o detalhe são
 * cópia: mexer no catálogo depois não reescreve proposta já enviada.
 */
export type ItemEscopo = { titulo: string; detalhe?: string; servicoId?: string };

export function lerEscopo(bruto: unknown): ItemEscopo[] {
  if (!Array.isArray(bruto)) return [];
  return bruto
    .filter((i): i is ItemEscopo => typeof i === "object" && i !== null && "titulo" in i)
    .map((i) => ({
      titulo: String(i.titulo),
      detalhe: i.detalhe ? String(i.detalhe) : undefined,
      servicoId: i.servicoId ? String(i.servicoId) : undefined,
    }));
}

/**
 * Escopo digitado como texto, um item por linha. "Título: detalhe" separa as duas
 * partes; sem dois-pontos, a linha inteira é o título. É mais rápido de escrever
 * no celular do que um formulário com campo por item.
 */
export function escopoDoTexto(texto: string): ItemEscopo[] {
  return texto
    .split("\n")
    .map((l) => l.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean)
    .map((linha) => {
      const i = linha.indexOf(":");
      if (i > 0 && i < 60) {
        return { titulo: linha.slice(0, i).trim(), detalhe: linha.slice(i + 1).trim() || undefined };
      }
      return { titulo: linha };
    });
}

export function escopoParaTexto(itens: ItemEscopo[]): string {
  return itens.map((i) => (i.detalhe ? `${i.titulo}: ${i.detalhe}` : i.titulo)).join("\n");
}

/**
 * Desconto: o que o serviço custa e o que esse cliente vai pagar.
 *
 * Só existe quando o valor cheio é maior que o cobrado. Desconto de R$ 0 ou
 * negativo não vira selo nenhum — "de R$ 1.800 por R$ 1.800" faz o cliente
 * desconfiar do resto da proposta.
 */
export function desconto(cheio: number | null, cobrado: number | null) {
  if (cheio == null || cobrado == null) return null;
  if (cheio <= cobrado) return null;
  const valor = cheio - cobrado;
  return { valor, pct: valor / cheio };
}

/** Períodos que a proposta oferece. Null é contrato sem prazo mínimo. */
export const PERIODOS: (number | null)[] = [null, 3, 6, 12];

export function rotuloPeriodo(meses: number | null): string {
  if (!meses) return "Sem prazo mínimo";
  if (meses === 12) return "12 meses";
  return `${meses} meses`;
}

/**
 * Quanto o desconto vale no contrato inteiro. É o número que fecha venda:
 * "R$ 200 por mês" é abstrato, "R$ 2.400 no ano" é dinheiro.
 */
export function economiaDoPeriodo(
  cheio: number | null,
  cobrado: number | null,
  meses: number | null,
): number | null {
  const d = desconto(cheio, cobrado);
  if (!d || !meses || meses < 2) return null;
  return d.valor * meses;
}

export type Situacao =
  | "rascunho"
  | "aguardando"
  | "visualizada"
  | "negociando"
  | "aceita"
  | "recusada"
  | "expirada";

/** Situações em que o lead ainda pode aceitar ou recusar pelo link. */
export const ABERTAS: Situacao[] = ["aguardando", "visualizada", "negociando"];

/** Situação que a pessoa enxerga, combinando status, validade e abertura. */
export function situacao(p: {
  status: string;
  validade: Date;
  visualizadaEm: Date | null;
}): Situacao {
  if (p.status === "RASCUNHO") return "rascunho";
  if (p.status === "ACEITA") return "aceita";
  if (p.status === "RECUSADA") return "recusada";
  // Em negociação a conversa está viva: a validade impressa não encerra nada.
  if (p.status === "NEGOCIANDO") return "negociando";
  // Validade é data pura: vale até o fim daquele dia.
  const fimDaValidade = new Date(p.validade.getTime() + 24 * 60 * 60 * 1000);
  if (fimDaValidade < new Date()) return "expirada";
  return p.visualizadaEm ? "visualizada" : "aguardando";
}

export const ROTULO_SITUACAO: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando: "Enviada, não aberta",
  visualizada: "Aberta, sem resposta",
  negociando: "Negociando",
  aceita: "Aceita",
  recusada: "Recusada",
  expirada: "Expirada",
};

export async function listarPropostas(agenciaId: string) {
  const propostas = await prisma.proposta.findMany({
    where: { cliente: { agenciaId } },
    orderBy: { criadoEm: "desc" },
    include: { cliente: { select: { nome: true, ciclo: true } } },
    take: 200,
  });
  return propostas.map((p) => ({ ...p, situacao: situacao(p) }));
}

/** Enviar: gera o link (uma vez só) e anda o ciclo do prospect. */
export async function marcarEnviada(propostaId: string) {
  const proposta = await prisma.proposta.findUnique({ where: { id: propostaId } });
  if (!proposta) return null;

  const atualizada = await prisma.proposta.update({
    where: { id: propostaId },
    data: {
      status: proposta.status === "RASCUNHO" ? "ENVIADA" : proposta.status,
      enviadaEm: proposta.enviadaEm ?? new Date(),
    },
  });

  await sincronizarCiclo(proposta.clienteId);
  return atualizada;
}

export async function propostaPublica(token: string) {
  if (!token || token.length < 32) return null;
  return prisma.proposta.findUnique({
    where: { token },
    include: { cliente: { select: { nome: true, contatoNome: true, agenciaId: true } } },
  });
}

/** Proposta só é alcançada pela agência dona do prospect dela. */
export async function propostaDaAgencia(propostaId: string, agenciaId: string) {
  return prisma.proposta.findFirst({ where: { id: propostaId, cliente: { agenciaId } } });
}

/** Registra que o lead abriu. Quem está logado no painel não conta. */
export async function registrarVisualizacao(propostaId: string) {
  const p = await prisma.proposta.findUnique({ where: { id: propostaId } });
  if (!p || p.status === "RASCUNHO") return;
  await prisma.proposta.update({
    where: { id: propostaId },
    data: { visualizadaEm: p.visualizadaEm ?? new Date(), visualizacoes: { increment: 1 } },
  });
}

/**
 * Aceite: fecha a proposta, torna o cliente ativo com o fee dela e abre a
 * tarefa de onboarding. É numa transação só porque metade disso aplicada seria
 * pior que nada: cliente ativo sem fee não gera fatura.
 */
export async function aceitarProposta(token: string, nome: string) {
  const p = await propostaPublica(token);
  if (!p) return { erro: "Proposta não encontrada." };

  const agora = situacao(p);
  if (agora === "aceita") return { ok: true };
  if (!ABERTAS.includes(agora)) {
    return { erro: "Essa proposta não está mais aberta para aceite." };
  }

  const inicio = hojeComoDataPura();
  const fim = p.meses
    ? new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + p.meses, inicio.getUTCDate()))
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.proposta.update({
      where: { id: p.id },
      data: { status: "ACEITA", respondidaEm: new Date(), aceitaPor: nome },
    });

    await tx.cliente.update({
      where: { id: p.clienteId },
      data: {
        ciclo: "ATIVO",
        feeMensal: p.feeMensal ?? undefined,
        inicioContrato: inicio,
        // Com prazo combinado, a renovação já entra no calendário: a tarefa
        // abre sozinha 30 dias antes, sem ninguém precisar lembrar.
        fimContrato: fim,
      },
    });

    await tx.tarefa.create({
      data: {
        agenciaId: p.cliente.agenciaId,
        clienteId: p.clienteId,
        titulo: "Onboarding: pedir acessos",
        descricao:
          "Business Manager, conta de anúncios, pixel, landing page e número de WhatsApp de atendimento.",
        prazo: hojeComoDataPura(undefined, 1),
      },
    });

    if (p.setup && Number(p.setup) > 0) {
      await tx.tarefa.create({
        data: {
          agenciaId: p.cliente.agenciaId,
          clienteId: p.clienteId,
          titulo: `Cobrar implantação de R$ ${Number(p.setup).toFixed(2)}`,
          descricao: "Lançar como cobrança avulsa no Negócio.",
        },
      });
    }
  });

  // Virou cliente: as tarefas de prospecção que sobraram se encerram.
  await aoMudarEtapa(p.clienteId);
  return { ok: true };
}

/**
 * Recusa exige motivo. "Não" sem porquê não ensina nada: o motivo é o que diz
 * se o problema foi preço, momento ou escopo, e é isso que muda a próxima.
 */
export const MOTIVO_MINIMO = 10;

export async function recusarProposta(token: string, motivo: string) {
  const p = await propostaPublica(token);
  if (!p) return { erro: "Proposta não encontrada." };

  const texto = motivo.trim();
  if (texto.length < MOTIVO_MINIMO) {
    return { erro: "Conta pra gente o motivo em uma frase. Isso ajuda muito." };
  }

  const agora = situacao(p);
  if (!ABERTAS.includes(agora)) {
    return { erro: "Essa proposta não está mais aberta." };
  }

  await prisma.proposta.update({
    where: { id: p.id },
    data: { status: "RECUSADA", respondidaEm: new Date(), motivoRecusa: texto },
  });

  // Recusada a única proposta, o prospect vira perdido com o mesmo motivo.
  await sincronizarCiclo(p.clienteId);
  await prisma.cliente.updateMany({
    where: { id: p.clienteId, ciclo: "PERDIDO", motivoPerda: null },
    data: { motivoPerda: texto },
  });

  return { ok: true };
}

/** Coloca ou tira de negociação, e leva o ciclo do prospect junto. */
export async function alternarNegociacao(propostaId: string) {
  const p = await prisma.proposta.findUnique({ where: { id: propostaId } });
  if (!p) return null;
  if (p.status !== "ENVIADA" && p.status !== "NEGOCIANDO") return null;

  const indo = p.status === "ENVIADA";
  await prisma.proposta.update({
    where: { id: propostaId },
    data: { status: indo ? "NEGOCIANDO" : "ENVIADA" },
  });

  await sincronizarCiclo(p.clienteId);
  return true;
}

/**
 * Excluir. Proposta aceita não se exclui: ela é o registro do que foi fechado e
 * o fee do cliente veio dela. As demais saem de vez — rascunho abandonado,
 * enviada por engano, recusada que não interessa mais guardar.
 */
export async function excluirProposta(propostaId: string) {
  const p = await prisma.proposta.findUnique({ where: { id: propostaId } });
  if (!p) return { erro: "Proposta não encontrada." };
  if (p.status === "ACEITA") {
    return { erro: "Proposta aceita é o registro do contrato e não pode ser excluída." };
  }
  await prisma.proposta.delete({ where: { id: propostaId } });

  // Sem isso o prospect ficava em "proposta enviada" sem proposta nenhuma.
  await sincronizarCiclo(p.clienteId);
  return { ok: true };
}

export { gerarToken };
