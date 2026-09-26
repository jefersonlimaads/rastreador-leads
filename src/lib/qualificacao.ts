import "server-only";
import { prisma } from "./prisma";
import { ETAPAS_QUALIFICADAS, MOTIVOS_PERDA, ONDE_APONTA, ROTULO_MOTIVO } from "./regras";

/**
 * Qualificação e motivo de perda.
 *
 * É o que separa dois problemas que pedem ações opostas: a campanha traz pouca
 * gente, ou traz gente errada. Sem isso, custo por lead sozinho manda escalar
 * justamente o anúncio barato que enche o funil de quem nunca vai comprar.
 *
 * Um lead conta como qualificado se está numa etapa de qualificado em diante,
 * ou se passou por lá antes de ser perdido. Quem fechou passou, mesmo que
 * ninguém tenha clicado na etapa — senão o atendimento rápido seria punido na
 * taxa.
 */

export type LeituraQualificacao = {
  contatos: number;
  qualificados: number;
  /** Qualificados sobre contatos. Null sem contato no período. */
  taxa: number | null;
  perdidos: number;
  /** Motivos, do mais frequente para o menos. */
  motivos: { chave: string; rotulo: string; quantos: number; ondeAponta: string }[];
  /** Para onde os motivos apontam somados: anúncio, atendimento, proposta. */
  culpa: { onde: string; quantos: number }[];
};

/** Só vira leitura com volume: três perdas não desenham um padrão. */
const MINIMO_PARA_PADRAO = 5;

export async function qualificacaoDoCliente(
  clienteId: string,
  de: Date,
  ate: Date,
): Promise<LeituraQualificacao> {
  const leads = await prisma.lead.findMany({
    where: { clienteId, arquivadoEm: null, criadoEm: { gte: de, lte: ate } },
    select: {
      status: true,
      motivoPerdaCategoria: true,
      eventos: {
        where: { tipo: "MUDANCA_STATUS" },
        select: { descricao: true },
      },
    },
  });

  const qualificadas = new Set<string>(ETAPAS_QUALIFICADAS);
  let qualificados = 0;
  const porMotivo = new Map<string, number>();
  let perdidos = 0;

  for (const l of leads) {
    // Está numa etapa de qualificado em diante, ou passou por lá antes de cair.
    const passou =
      qualificadas.has(l.status) ||
      l.eventos.some((e) => e.descricao?.includes("Qualificado"));
    if (passou) qualificados++;

    if (l.status === "PERDIDO") {
      perdidos++;
      const chave = l.motivoPerdaCategoria ?? "SEM_MOTIVO";
      porMotivo.set(chave, (porMotivo.get(chave) ?? 0) + 1);
    }
  }

  const motivos = [...porMotivo.entries()]
    .map(([chave, quantos]) => ({
      chave,
      rotulo: ROTULO_MOTIVO[chave] ?? "Sem motivo registrado",
      quantos,
      ondeAponta: ONDE_APONTA[chave] ?? "dado",
    }))
    .sort((a, b) => b.quantos - a.quantos);

  const porOnde = new Map<string, number>();
  for (const m of motivos) {
    if (m.chave === "SEM_MOTIVO") continue;
    porOnde.set(m.ondeAponta, (porOnde.get(m.ondeAponta) ?? 0) + m.quantos);
  }

  return {
    contatos: leads.length,
    qualificados,
    taxa: leads.length > 0 ? qualificados / leads.length : null,
    perdidos,
    motivos,
    culpa: [...porOnde.entries()]
      .map(([onde, quantos]) => ({ onde, quantos }))
      .sort((a, b) => b.quantos - a.quantos),
  };
}

const ONDE: Record<string, { titulo: string; acao: string }> = {
  anuncio: {
    titulo: "A maioria das perdas aponta para o anúncio",
    acao: "Sem interesse, sem orçamento e fora da região em volume são segmentação e promessa: ajuste público, região e o que o criativo promete antes de mexer no atendimento.",
  },
  atendimento: {
    titulo: "A maioria das perdas aponta para o atendimento",
    acao: "Não respondeu e atendimento demorado são do cliente, não da mídia. Leve o tempo de resposta para a conversa com ele — a verba está trazendo gente que não está sendo atendida.",
  },
  proposta: {
    titulo: "A maioria das perdas acontece na proposta",
    acao: "Quem chega até a proposta e escolhe o concorrente é preço, prazo ou diferenciação. A mídia entregou; o gargalo é comercial.",
  },
  dado: {
    titulo: "A maioria das perdas está sem causa clara",
    acao: "Muitos motivos em 'outro' ou 'duplicado' significam que a leitura de perda não está sendo preenchida com cuidado — e sem ela não dá para separar anúncio de atendimento.",
  },
};

/** A frase pronta sobre onde as perdas se concentram, quando há volume. */
export function leituraDaPerda(q: LeituraQualificacao): { titulo: string; motivo: string; acao: string } | null {
  if (q.perdidos < MINIMO_PARA_PADRAO) return null;
  const topo = q.culpa[0];
  if (!topo) return null;

  const fatia = topo.quantos / q.perdidos;
  if (fatia < 0.5) return null;

  const texto = ONDE[topo.onde] ?? ONDE.dado;
  const principais = q.motivos
    .filter((m) => m.ondeAponta === topo.onde)
    .slice(0, 2)
    .map((m) => `${m.rotulo.toLowerCase()} (${m.quantos})`)
    .join(" e ");

  return {
    titulo: texto.titulo,
    motivo: `${topo.quantos} de ${q.perdidos} perdas: ${principais}.`,
    acao: texto.acao,
  };
}

export { MOTIVOS_PERDA };
