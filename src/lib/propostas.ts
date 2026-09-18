import "server-only";
import { prisma } from "./prisma";
import { gerarToken } from "./confirmacao";
import { hojeComoDataPura } from "./datas";

/**
 * Propostas comerciais da jl.ads.
 *
 * O ciclo do prospect anda junto com a proposta: enviar coloca o cliente em
 * "proposta enviada", aceitar o torna ativo com o fee da proposta e abre a
 * tarefa de onboarding. Assim o Negócio nunca fica desatualizado em relação ao
 * que foi fechado.
 */

export type ItemEscopo = { titulo: string; detalhe?: string };

export function lerEscopo(bruto: unknown): ItemEscopo[] {
  if (!Array.isArray(bruto)) return [];
  return bruto
    .filter((i): i is ItemEscopo => typeof i === "object" && i !== null && "titulo" in i)
    .map((i) => ({ titulo: String(i.titulo), detalhe: i.detalhe ? String(i.detalhe) : undefined }));
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

/** Situação que a pessoa enxerga, combinando status, validade e abertura. */
export function situacao(p: {
  status: string;
  validade: Date;
  visualizadaEm: Date | null;
}): "rascunho" | "aguardando" | "visualizada" | "aceita" | "recusada" | "expirada" {
  if (p.status === "RASCUNHO") return "rascunho";
  if (p.status === "ACEITA") return "aceita";
  if (p.status === "RECUSADA") return "recusada";
  // Validade é data pura: vale até o fim daquele dia.
  const fimDaValidade = new Date(p.validade.getTime() + 24 * 60 * 60 * 1000);
  if (fimDaValidade < new Date()) return "expirada";
  return p.visualizadaEm ? "visualizada" : "aguardando";
}

export const ROTULO_SITUACAO: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando: "Enviada, não aberta",
  visualizada: "Aberta, sem resposta",
  aceita: "Aceita",
  recusada: "Recusada",
  expirada: "Expirada",
};

export async function listarPropostas() {
  const propostas = await prisma.proposta.findMany({
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

  await prisma.cliente.updateMany({
    where: { id: proposta.clienteId, ciclo: "PROSPECCAO" },
    data: { ciclo: "PROPOSTA_ENVIADA" },
  });

  return atualizada;
}

export async function propostaPublica(token: string) {
  if (!token || token.length < 32) return null;
  return prisma.proposta.findUnique({
    where: { token },
    include: { cliente: { select: { nome: true, contatoNome: true } } },
  });
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
  if (agora !== "aguardando" && agora !== "visualizada") {
    return { erro: "Essa proposta não está mais aberta para aceite." };
  }

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
        inicioContrato: hojeComoDataPura(),
      },
    });

    await tx.tarefa.create({
      data: {
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
          clienteId: p.clienteId,
          titulo: `Cobrar implantação de R$ ${Number(p.setup).toFixed(2)}`,
          descricao: "Lançar como cobrança avulsa no Negócio.",
        },
      });
    }
  });

  return { ok: true };
}

export async function recusarProposta(token: string, motivo: string) {
  const p = await propostaPublica(token);
  if (!p) return { erro: "Proposta não encontrada." };

  const agora = situacao(p);
  if (agora !== "aguardando" && agora !== "visualizada") {
    return { erro: "Essa proposta não está mais aberta." };
  }

  await prisma.proposta.update({
    where: { id: p.id },
    data: { status: "RECUSADA", respondidaEm: new Date(), motivoRecusa: motivo || null },
  });

  return { ok: true };
}

export { gerarToken };
