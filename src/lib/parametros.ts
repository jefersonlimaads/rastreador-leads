import "server-only";
import { prisma } from "./prisma";
import { PADRAO_DAS_REGUAS, type ChaveRegua, type Faixa, type Reguas } from "./reguas";

/**
 * A régua de cada etapa, resolvida para um cliente.
 *
 * Do mais específico para o mais geral: régua do cliente, régua do nicho,
 * régua da agência, padrão do código. Assim o administrador ajusta o que
 * conhece e herda o resto, em vez de preencher tudo para mexer em um número.
 *
 * O padrão do código continua existindo de propósito: um sistema que exige
 * configurar antes de dizer qualquer coisa não é usado.
 */

export type ReguaResolvida = Faixa & {
  /** De onde veio o número, para a tela poder dizer. */
  origem: "cliente" | "nicho" | "agencia" | "padrao";
};

export type ReguasDoCliente = Record<ChaveRegua, ReguaResolvida>;

export async function reguasDoCliente(clienteId: string): Promise<ReguasDoCliente> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { agenciaId: true, nicho: true },
  });
  if (!cliente) return comPadrao({});

  const linhas = await prisma.parametroDiagnostico.findMany({
    where: {
      agenciaId: cliente.agenciaId,
      OR: [
        { clienteId },
        ...(cliente.nicho ? [{ nicho: cliente.nicho, clienteId: null }] : []),
        { clienteId: null, nicho: null },
      ],
    },
    select: { chave: true, ruim: true, bom: true, clienteId: true, nicho: true },
  });

  /* Cliente ganha de nicho, que ganha de agência. Guardo o peso junto para a
     comparação não depender de reconstruir a origem depois. */
  const PESO = { cliente: 3, nicho: 2, agencia: 1 } as const;
  const escolhidas: Partial<Record<ChaveRegua, ReguaResolvida>> = {};

  for (const l of linhas) {
    const chave = l.chave as ChaveRegua;
    if (!(chave in PADRAO_DAS_REGUAS)) continue;

    const origem = l.clienteId ? "cliente" : l.nicho ? "nicho" : "agencia";
    const atual = escolhidas[chave];
    if (atual && PESO[atual.origem as keyof typeof PESO] >= PESO[origem]) continue;

    escolhidas[chave] = { ruim: l.ruim, bom: l.bom, origem };
  }

  return comPadrao(escolhidas);
}

function comPadrao(escolhidas: Partial<Record<ChaveRegua, ReguaResolvida>>): ReguasDoCliente {
  const saida = {} as ReguasDoCliente;
  for (const chave of Object.keys(PADRAO_DAS_REGUAS) as ChaveRegua[]) {
    saida[chave] = escolhidas[chave] ?? { ...PADRAO_DAS_REGUAS[chave], origem: "padrao" };
  }
  return saida;
}

/** Só as faixas, do jeito que o funil consome. */
export function apenasFaixas(r: ReguasDoCliente): Reguas {
  const saida = {} as Reguas;
  for (const chave of Object.keys(r) as ChaveRegua[]) {
    saida[chave] = { ruim: r[chave].ruim, bom: r[chave].bom };
  }
  return saida;
}

/**
 * Grava uma régua. Valor igual ao padrão do código apaga a linha: assim a
 * herança volta a valer, e a tela não fica cheia de "personalizado" que não
 * personaliza nada.
 */
export async function definirRegua(params: {
  agenciaId: string;
  clienteId?: string | null;
  nicho?: string | null;
  chave: ChaveRegua;
  ruim: number;
  bom: number;
}) {
  const padrao = PADRAO_DAS_REGUAS[params.chave];
  if (!padrao) return null;
  if (params.ruim >= params.bom) return { erro: "O valor de 'bom' precisa ser maior que o de 'ruim'." };

  const alvo = {
    agenciaId: params.agenciaId,
    clienteId: params.clienteId ?? null,
    nicho: params.nicho ?? null,
    chave: params.chave,
  };

  if (params.ruim === padrao.ruim && params.bom === padrao.bom) {
    await prisma.parametroDiagnostico.deleteMany({ where: alvo });
    return { ok: true, voltouAoPadrao: true };
  }

  const existente = await prisma.parametroDiagnostico.findFirst({ where: alvo, select: { id: true } });
  if (existente) {
    await prisma.parametroDiagnostico.update({
      where: { id: existente.id },
      data: { ruim: params.ruim, bom: params.bom },
    });
  } else {
    await prisma.parametroDiagnostico.create({
      data: { ...alvo, ruim: params.ruim, bom: params.bom },
    });
  }
  return { ok: true, voltouAoPadrao: false };
}
