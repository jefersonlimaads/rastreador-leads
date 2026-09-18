/**
 * Datas sempre no fuso do cliente, nunca no do servidor.
 *
 * Na Vercel o servidor roda em UTC. Sem isto, um lead recebido às 18h em São
 * Paulo aparecia como 21h no painel, a janela de 30 minutos da atribuição
 * provável errava por três horas, e o "gasto do dia" cruzava com leads do dia
 * errado.
 */

export const FUSO_PADRAO = "America/Sao_Paulo";

/** "2026-09-17 18:09:00" — o instante visto de dentro do fuso. */
function partesNoFuso(data: Date, fuso: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(data)
    .replace(" ", "T");
}

/** Quanto o fuso está adiantado ou atrasado em relação ao UTC, em milissegundos. */
function deslocamento(data: Date, fuso: string): number {
  return new Date(partesNoFuso(data, fuso) + "Z").getTime() - data.getTime();
}

export function formatarDataHora(data: Date, fuso: string = FUSO_PADRAO): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: fuso,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

export function formatarData(data: Date, fuso: string = FUSO_PADRAO): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: fuso,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(data);
}

/** Meia-noite do dia daquele instante, no fuso, devolvida como instante real. */
export function inicioDoDia(data: Date, fuso: string = FUSO_PADRAO): Date {
  const dia = partesNoFuso(data, fuso).slice(0, 10);
  const meiaNoiteComoUtc = new Date(dia + "T00:00:00Z");
  return new Date(meiaNoiteComoUtc.getTime() - deslocamento(meiaNoiteComoUtc, fuso));
}

export function fimDoDia(data: Date, fuso: string = FUSO_PADRAO): Date {
  const inicio = inicioDoDia(data, fuso);
  return new Date(inicio.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/** Período do painel: os últimos N dias fechando hoje, no fuso do cliente. */
export function periodoPadrao(dias = 30, fuso: string = FUSO_PADRAO) {
  const agora = new Date();
  const ate = fimDoDia(agora, fuso);
  const de = inicioDoDia(new Date(ate.getTime() - (dias - 1) * 24 * 60 * 60 * 1000), fuso);
  return { de, ate };
}
