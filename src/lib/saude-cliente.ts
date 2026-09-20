import "server-only";
import { prisma } from "./prisma";

/**
 * Saúde da implantação de um cliente: o que está de pé e o que falta para os
 * números serem confiáveis.
 *
 * Existe porque o erro caro não é o número errado — é descobrir semanas depois
 * que ele estava errado. Cada item aqui é uma causa real de número torto:
 * script fora da página, anúncio sem parâmetro, conta não ligada, gasto sem
 * sincronizar, API de Conversões desligada.
 */

export type ItemSaude = {
  chave: string;
  titulo: string;
  estado: "ok" | "falta" | "alerta";
  detalhe: string;
  /** O que fazer, quando não está ok. */
  comoResolver?: string;
};

export type SaudeCliente = {
  itens: ItemSaude[];
  /** Quantos itens não estão ok: é o número que vai no selo da carteira. */
  pendencias: number;
  /** Gasto correndo sem nenhuma visita registrada: dinheiro saindo às cegas. */
  rastreamentoParado: { gasto: number; horas: number } | null;
};

const HORAS_SEM_VISITA = 48;

export async function saudeDoCliente(clienteId: string): Promise<SaudeCliente> {
  const agora = new Date();
  const desde48h = new Date(agora.getTime() - HORAS_SEM_VISITA * 60 * 60 * 1000);
  const desde7d = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [cliente, gasto48h, cliques48h, cliquesTotal, cliquesComAnuncio, ultimaSync, leads7d] =
    await Promise.all([
      prisma.cliente.findUnique({
        where: { id: clienteId },
        select: {
          nome: true,
          pixelId: true,
          capiToken: true,
          numeros: { where: { ativo: true }, select: { id: true } },
          contas: { select: { id: true } },
        },
      }),
      prisma.gasto.aggregate({
        where: { clienteId, dia: { gte: new Date(desde48h.toISOString().slice(0, 10)) } },
        _sum: { valor: true },
      }),
      prisma.clique.count({ where: { clienteId, criadoEm: { gte: desde48h } } }),
      prisma.clique.count({ where: { clienteId } }),
      prisma.clique.count({ where: { clienteId, adId: { not: null }, criadoEm: { gte: desde7d } } }),
      prisma.gasto.findFirst({ where: { clienteId }, orderBy: { atualizadoEm: "desc" }, select: { atualizadoEm: true } }),
      prisma.lead.count({ where: { clienteId, arquivadoEm: null, criadoEm: { gte: desde7d } } }),
    ]);
  if (!cliente) return { itens: [], pendencias: 0, rastreamentoParado: null };

  const gastoRecente = Number(gasto48h._sum.valor ?? 0);
  const horasDesdeSync = ultimaSync ? (agora.getTime() - ultimaSync.atualizadoEm.getTime()) / 3_600_000 : null;

  const itens: ItemSaude[] = [
    {
      chave: "conta",
      titulo: "Conta de anúncios ligada",
      estado: cliente.contas.length > 0 ? "ok" : "falta",
      detalhe: cliente.contas.length > 0 ? `${cliente.contas.length} ligada(s)` : "sem conta ligada",
      comoResolver: "Ajustes → Contas de anúncios → Ligar conta.",
    },
    {
      chave: "sync",
      titulo: "Gasto atualizado",
      estado: !ultimaSync ? "falta" : horasDesdeSync! > 36 ? "alerta" : "ok",
      detalhe: !ultimaSync
        ? "nunca sincronizado"
        : `última busca há ${Math.round(horasDesdeSync!)}h`,
      comoResolver: "Ajustes → Puxar dados do Meta agora. A rotina diária roda de manhã.",
    },
    {
      chave: "script",
      titulo: "Script na página",
      estado: cliques48h > 0 ? "ok" : cliquesTotal > 0 ? "alerta" : "falta",
      detalhe:
        cliques48h > 0
          ? `${cliques48h} visitas nas últimas 48h`
          : cliquesTotal > 0
            ? "nenhuma visita nas últimas 48h"
            : "nenhuma visita registrada até hoje",
      comoResolver: "Ajustes → Script da página. Cole antes do </body> e publique o site.",
    },
    {
      chave: "parametros",
      titulo: "Parâmetros de URL nos anúncios",
      estado: cliquesComAnuncio > 0 ? "ok" : cliques48h > 0 ? "falta" : "alerta",
      detalhe:
        cliquesComAnuncio > 0
          ? `${cliquesComAnuncio} visitas com anúncio identificado (7 dias)`
          : "nenhuma visita trouxe o anúncio de origem",
      comoResolver: "Gerenciador de Anúncios → cada anúncio → Rastreamento → Parâmetros de URL.",
    },
    {
      chave: "whatsapp",
      titulo: "WhatsApp de atendimento",
      estado: cliente.numeros.length > 0 ? "ok" : "falta",
      detalhe: cliente.numeros.length > 0 ? "cadastrado" : "não cadastrado",
      comoResolver: "Ajustes → WhatsApp de atendimento.",
    },
    {
      chave: "capi",
      titulo: "API de Conversões",
      estado: cliente.pixelId && cliente.capiToken ? "ok" : "falta",
      detalhe: cliente.pixelId && cliente.capiToken ? "ligada" : "desligada",
      comoResolver: "Ajustes → API de Conversões. Sem ela, o Meta perde parte dos leads.",
    },
  ];

  return {
    itens,
    pendencias: itens.filter((i) => i.estado !== "ok").length,
    // Só é alarme quando há dinheiro saindo: cliente parado não precisa de susto.
    rastreamentoParado:
      gastoRecente > 0 && cliques48h === 0 && cliquesTotal > 0 && leads7d === 0
        ? { gasto: gastoRecente, horas: HORAS_SEM_VISITA }
        : null,
  };
}
