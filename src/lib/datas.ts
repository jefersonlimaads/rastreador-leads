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

/**
 * Data pura, sem hora: vencimento, competência, início de contrato.
 *
 * O banco guarda esses campos como data e devolve meia-noite em UTC. Formatar
 * isso no fuso de São Paulo joga o dia para trás — vencimento dia 10 aparecia
 * como 09. Aqui a data é lida como ela foi escrita.
 */
export function formatarDataPura(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(data);
}

export function formatarMesPuro(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(data);
}

/**
 * "Hoje" como data pura, no calendário do fuso — para gravar em campo de data.
 *
 * new Date() no servidor é UTC: às 21h de São Paulo já é o dia seguinte em
 * Londres, e o contrato fechado à noite nascia com a data de amanhã.
 */
export function hojeComoDataPura(fuso: string = FUSO_PADRAO, somarDias = 0): Date {
  const [ano, mes, dia] = partesNoFuso(new Date(), fuso).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + somarDias));
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

/** Ano, mês, dia, hora, minuto e dia da semana de um instante, no fuso. */
export function partesLocais(data: Date, fuso: string = FUSO_PADRAO) {
  const texto = partesNoFuso(data, fuso); // "2026-09-18T14:30:00"
  const [dia, hora] = texto.split("T");
  const [ano, mes, d] = dia.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  // Dia da semana calculado pela data local, não pelo instante em UTC.
  const diaSemana = new Date(Date.UTC(ano, mes - 1, d)).getUTCDay();
  return { ano, mes, dia: d, hora: h, minuto: m, diaSemana };
}

/** Instante real a partir de data e hora locais do fuso. */
export function instanteLocal(
  ano: number,
  mes: number,
  dia: number,
  hora = 0,
  minuto = 0,
  fuso: string = FUSO_PADRAO,
): Date {
  const comoUtc = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto));
  return new Date(comoUtc.getTime() - deslocamento(comoUtc, fuso));
}

/** Data pura (meia-noite UTC) do dia em que o instante cai, no fuso. */
export function dataPuraDe(data: Date, fuso: string = FUSO_PADRAO): Date {
  const p = partesLocais(data, fuso);
  return new Date(Date.UTC(p.ano, p.mes - 1, p.dia));
}

export function formatarHora(data: Date, fuso: string = FUSO_PADRAO): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: fuso,
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}
