import "server-only";
import { prisma } from "./prisma";

/**
 * Tempo de resposta: quanto tempo o lead espera até alguém falar com ele, e o
 * que essa espera custa em vendas.
 *
 * O primeiro toque é o primeiro evento depois da chegada: "Registrei contato",
 * mudança de etapa ou nota. É o argumento mais forte que existe para cobrar
 * postura do cliente, porque sai do número dele, não de estudo de internet.
 */

export type FaixaResposta = {
  rotulo: string;
  leads: number;
  fechados: number;
  /** Fechamento dentro da faixa (0 a 1). */
  taxa: number | null;
};

export type TempoDeResposta = {
  leads: number;
  respondidos: number;
  /** Mediana em minutos até o primeiro toque. */
  medianaMin: number | null;
  faixas: FaixaResposta[];
  semResposta: number;
  /** Frase pronta quando dá para comparar rápido x devagar. */
  comparacao: string | null;
};

const FAIXAS: { rotulo: string; ate: number }[] = [
  { rotulo: "Até 10 minutos", ate: 10 },
  { rotulo: "10 min a 1 hora", ate: 60 },
  { rotulo: "1 a 24 horas", ate: 60 * 24 },
  { rotulo: "Mais de 24 horas", ate: Infinity },
];

export async function tempoDeResposta(clienteId: string, de: Date, ate: Date): Promise<TempoDeResposta> {
  const leads = await prisma.lead.findMany({
    where: { clienteId, arquivadoEm: null, criadoEm: { gte: de, lte: ate } },
    select: {
      criadoEm: true,
      status: true,
      eventos: {
        where: { tipo: { in: ["CONTATO", "MUDANCA_STATUS", "NOTA"] } },
        orderBy: { criadoEm: "asc" },
        take: 1,
        select: { criadoEm: true },
      },
    },
  });

  const contagem = FAIXAS.map((f) => ({ rotulo: f.rotulo, leads: 0, fechados: 0, taxa: null as number | null }));
  const minutos: number[] = [];
  let semResposta = 0;

  for (const l of leads) {
    const primeiro = l.eventos[0]?.criadoEm;
    if (!primeiro) {
      semResposta++;
      continue;
    }
    const min = Math.max(0, (primeiro.getTime() - l.criadoEm.getTime()) / 60000);
    minutos.push(min);
    const i = FAIXAS.findIndex((f) => min <= f.ate);
    contagem[i].leads++;
    if (l.status === "FECHADO") contagem[i].fechados++;
  }

  for (const f of contagem) f.taxa = f.leads > 0 ? f.fechados / f.leads : null;

  minutos.sort((a, b) => a - b);
  const medianaMin =
    minutos.length === 0
      ? null
      : minutos.length % 2
        ? minutos[(minutos.length - 1) / 2]
        : (minutos[minutos.length / 2 - 1] + minutos[minutos.length / 2]) / 2;

  // Rápido = respondido em até 1 hora; devagar = depois disso.
  const rapidos = contagem.slice(0, 2).reduce((s, f) => ({ leads: s.leads + f.leads, fechados: s.fechados + f.fechados }), { leads: 0, fechados: 0 });
  const devagar = contagem.slice(2).reduce((s, f) => ({ leads: s.leads + f.leads, fechados: s.fechados + f.fechados }), { leads: 0, fechados: 0 });
  let comparacao: string | null = null;
  if (rapidos.leads >= 5 && devagar.leads >= 5) {
    const taxaRapido = rapidos.fechados / rapidos.leads;
    const taxaDevagar = devagar.fechados / devagar.leads;
    const fmt = (t: number) => `${(t * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    if (taxaDevagar === 0 && taxaRapido > 0) {
      comparacao = `Respondendo em até 1 hora, ${fmt(taxaRapido)} viraram venda. Depois de 1 hora, nenhuma.`;
    } else if (taxaRapido > taxaDevagar * 1.2) {
      const vezes = (taxaRapido / taxaDevagar).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
      comparacao = `Respondendo em até 1 hora, ${fmt(taxaRapido)} viraram venda, contra ${fmt(taxaDevagar)} depois disso: ${vezes}x mais.`;
    } else if (taxaDevagar > taxaRapido) {
      comparacao = `Aqui a demora não mudou o fechamento: ${fmt(taxaRapido)} respondendo rápido contra ${fmt(taxaDevagar)} depois de 1 hora.`;
    }
  }

  return {
    leads: leads.length,
    respondidos: minutos.length,
    medianaMin,
    faixas: contagem,
    semResposta,
    comparacao,
  };
}

/** "18 min", "3h20", "2 dias": tempo curto de ler. */
export function formatarEspera(minutos: number | null): string {
  if (minutos == null) return "—";
  if (minutos < 1) return "menos de 1 min";
  if (minutos < 60) return `${Math.round(minutos)} min`;
  if (minutos < 60 * 24) {
    const h = Math.floor(minutos / 60);
    const m = Math.round(minutos % 60);
    return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
  }
  const d = minutos / (60 * 24);
  return `${d.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`;
}
