import "server-only";
import { prisma } from "./prisma";
import { FUSO_PADRAO, hojeComoDataPura } from "./datas";
import { CICLOS_EM_PROSPECCAO } from "./regras";

/**
 * Lado comercial da jl.ads: quanto entra por mês, quem pagou e quem atrasou.
 *
 * Fatura é por competência, não por data de pagamento: a de outubro é a de
 * outubro mesmo que o cliente pague em novembro. É assim que se enxerga receita
 * recorrente sem confundir com fluxo de caixa.
 */

// Rótulos e listas ficam em regras.ts porque a tela do cliente é componente de
// navegador e não pode importar módulo marcado como só-servidor.
export {
  CICLOS_EM_CARTEIRA,
  CICLOS_EM_PROSPECCAO,
  ROTULO_CICLO,
  ROTULO_FATURA,
} from "./regras";

/** Primeiro dia do mês, que é como a competência é guardada. */
export function competenciaDe(data = new Date()): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 1));
}

function vencimentoDe(competencia: Date, dia: number): Date {
  const seguro = Math.min(Math.max(dia, 1), 28);
  return new Date(Date.UTC(competencia.getUTCFullYear(), competencia.getUTCMonth(), seguro));
}

/**
 * Cria a fatura do mês para cada cliente ativo com fee. Roda na rotina diária:
 * é idempotente, porque competência é única por cliente.
 */
/** Sem agência: todas (rotina diária). Com agência: só as dela (botão no painel). */
export async function gerarFaturasDoMes(competencia = competenciaDe(), agenciaId?: string) {
  const clientes = await prisma.cliente.findMany({
    where: { ciclo: "ATIVO", feeMensal: { not: null }, ...(agenciaId ? { agenciaId } : {}) },
    select: { id: true, feeMensal: true, diaVencimento: true, linkPagamento: true },
  });

  let criadas = 0;
  for (const cliente of clientes) {
    const existe = await prisma.fatura.findUnique({
      where: { clienteId_competencia: { clienteId: cliente.id, competencia } },
    });
    if (existe) continue;

    await prisma.fatura.create({
      data: {
        clienteId: cliente.id,
        competencia,
        valor: cliente.feeMensal!,
        vencimento: vencimentoDe(competencia, cliente.diaVencimento ?? 10),
        linkPagamento: cliente.linkPagamento,
      },
    });
    criadas++;
  }

  return { criadas, competencia: competencia.toISOString().slice(0, 7) };
}

export type ResumoFinanceiro = {
  receitaRecorrente: number;
  faturadoNoMes: number;
  recebidoNoMes: number;
  emAberto: number;
  atrasado: number;
  atrasadas: number;
  clientesAtivos: number;
  emProspeccao: number;
  /** Custo direto somado dos clientes ativos: freelancer, ferramenta, edição. */
  custoDireto: number;
  /** true quando algum cliente entrou pela estimativa, não por despesa lançada. */
  custoEstimado: boolean;
  /** O que sobra por mês depois do custo direto. */
  margem: number;
  /** Margem sobre a receita recorrente (0 a 1). */
  margemPct: number | null;
};

export async function resumoFinanceiro(agenciaId: string, fuso = FUSO_PADRAO): Promise<ResumoFinanceiro> {
  const competencia = competenciaDe();
  // Vencimento é data pura: comparar com o instante das 00h de São Paulo
  // marcava como atrasada a fatura que vence hoje.
  const hoje = hojeComoDataPura(fuso);

  const [clientes, doMes, abertas, custos] = await Promise.all([
    prisma.cliente.findMany({
      where: { agenciaId, ativo: true },
      select: { id: true, ciclo: true, feeMensal: true },
    }),
    prisma.fatura.findMany({
      where: { competencia, cliente: { agenciaId } },
      select: { valor: true, status: true },
    }),
    prisma.fatura.findMany({
      where: { status: "ABERTA", cliente: { agenciaId } },
      select: { valor: true, vencimento: true },
    }),
    custoPorCliente(agenciaId, competencia),
  ]);

  const soma = (lista: { valor: unknown }[]) =>
    lista.reduce((t, f) => t + Number(f.valor), 0);

  const vencidas = abertas.filter((f) => f.vencimento < hoje);

  const ativos = clientes.filter((c) => c.ciclo === "ATIVO");
  const receitaRecorrente = ativos.reduce((t, c) => t + Number(c.feeMensal ?? 0), 0);
  // Despesa lançada manda; sem ela, vale a estimativa do cadastro.
  const custoDireto = ativos.reduce((t, c) => t + (custos.get(c.id)?.valor ?? 0), 0);
  const algumEstimado = ativos.some((c) => custos.get(c.id)?.origem === "estimado");

  return {
    receitaRecorrente,
    faturadoNoMes: soma(doMes.filter((f) => f.status !== "CANCELADA")),
    recebidoNoMes: soma(doMes.filter((f) => f.status === "PAGA")),
    emAberto: soma(abertas),
    atrasado: soma(vencidas),
    atrasadas: vencidas.length,
    clientesAtivos: clientes.filter((c) => c.ciclo === "ATIVO").length,
    emProspeccao: clientes.filter((c) =>
      (CICLOS_EM_PROSPECCAO as readonly string[]).includes(c.ciclo),
    ).length,
    custoDireto,
    custoEstimado: algumEstimado,
    margem: receitaRecorrente - custoDireto,
    margemPct: receitaRecorrente > 0 ? (receitaRecorrente - custoDireto) / receitaRecorrente : null,
  };
}

/** Lista de clientes com a situação financeira de cada um. */
export async function carteiraComercial(agenciaId: string, fuso = FUSO_PADRAO) {
  // Vencimento é data pura: comparar com o instante das 00h de São Paulo
  // marcava como atrasada a fatura que vence hoje.
  const hoje = hojeComoDataPura(fuso);
  const competencia = competenciaDe();

  const [clientes, custos] = await Promise.all([
    prisma.cliente.findMany({
      where: { agenciaId, ativo: true },
      orderBy: [{ ciclo: "asc" }, { nome: "asc" }],
      include: {
        faturas: { orderBy: { competencia: "desc" }, take: 3 },
        _count: { select: { leads: true } },
      },
    }),
    custoPorCliente(agenciaId, competencia),
  ]);

  return clientes.map((c) => {
    const doMes = c.faturas.find(
      (f) => f.competencia.getTime() === competencia.getTime() && f.status !== "CANCELADA",
    );
    const vencidas = c.faturas.filter((f) => f.status === "ABERTA" && f.vencimento < hoje);

    return {
      id: c.id,
      nome: c.nome,
      ciclo: c.ciclo,
      feeMensal: c.feeMensal ? Number(c.feeMensal) : null,
      custoMensal: custos.get(c.id)?.valor ?? null,
      custoEstimado: custos.get(c.id)?.origem === "estimado",
      // Margem só existe quando há fee: sem os dois números, ela seria chute.
      margem: c.feeMensal ? Number(c.feeMensal) - (custos.get(c.id)?.valor ?? 0) : null,
      diaVencimento: c.diaVencimento,
      contatoNome: c.contatoNome,
      leads: c._count.leads,
      faturaDoMes: doMes
        ? {
            id: doMes.id,
            valor: Number(doMes.valor),
            status: doMes.status,
            vencimento: doMes.vencimento,
            atrasada: doMes.status === "ABERTA" && doMes.vencimento < hoje,
            linkPagamento: doMes.linkPagamento,
          }
        : null,
      atrasadas: vencidas.length,
    };
  });
}

export async function detalheComercial(clienteId: string, agenciaId: string) {
  return prisma.cliente.findFirst({
    where: { id: clienteId, agenciaId },
    include: {
      faturas: { orderBy: { competencia: "desc" }, take: 24 },
      entregas: { orderBy: [{ competencia: "desc" }, { criadoEm: "desc" }], take: 40 },
      numeros: true,
      _count: { select: { leads: true, cliques: true } },
    },
  });
}

/**
 * Renovação de contrato.
 *
 * Abre a tarefa 30 dias antes do fim — o prazo em que ainda dá para mostrar
 * resultado e negociar valor, em vez de pedir renovação com a data em cima.
 * Idempotente pela chave, então roda todo dia sem duplicar.
 */
export async function abrirTarefasDeRenovacao(fuso = FUSO_PADRAO) {
  const hoje = hojeComoDataPura(fuso);
  const limite = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);

  const clientes = await prisma.cliente.findMany({
    where: { ativo: true, ciclo: "ATIVO", fimContrato: { not: null, lte: limite } },
    select: { id: true, nome: true, agenciaId: true, fimContrato: true },
  });

  let criadas = 0;
  for (const c of clientes) {
    const chave = `renovacao-${c.fimContrato!.toISOString().slice(0, 10)}`;
    const existe = await prisma.tarefa.findFirst({
      where: { clienteId: c.id, chave },
      select: { id: true },
    });
    if (existe) continue;

    await prisma.tarefa.create({
      data: {
        agenciaId: c.agenciaId,
        clienteId: c.id,
        titulo: `Renovação do contrato de ${c.nome}`,
        descricao:
          "Contrato vence em menos de 30 dias. Leve o relatório do período inteiro para a conversa: renovação se negocia com resultado na mesa, não com prazo estourando.",
        // Uma semana antes do fim: prazo de conversa, não de assinatura.
        prazo: new Date(c.fimContrato!.getTime() - 7 * 24 * 60 * 60 * 1000),
        automatica: true,
        chave,
      },
    });
    criadas++;
  }

  return criadas;
}

/* ——— Despesas e fluxo de caixa ——— */

export const CATEGORIAS_DESPESA = [
  "Ferramenta",
  "Freelancer",
  "Mídia",
  "Imposto",
  "Escritório",
  "Outro",
] as const;

export type MesDeCaixa = {
  /** Primeiro dia do mês. */
  competencia: Date;
  rotulo: string;
  receitaPrevista: number;
  receitaRecebida: number;
  despesaLancada: number;
  despesaPaga: number;
  /** Previsto menos lançado: o que o mês promete. */
  saldoPrevisto: number;
  /** Recebido menos pago: o que de fato entrou e saiu. */
  saldoRealizado: number;
};

/**
 * O caixa mês a mês, do mais antigo para o mais novo.
 *
 * Dois saldos de propósito. O previsto diz se o mês fecha no azul; o realizado
 * diz o que já passou pela conta. Misturar os dois é como se acha que está
 * tudo bem em um mês que ninguém pagou ainda.
 */
export async function fluxoDeCaixa(agenciaId: string, meses = 6): Promise<MesDeCaixa[]> {
  const hoje = competenciaDe();
  const primeiro = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - (meses - 1), 1));

  const [faturas, despesas] = await Promise.all([
    prisma.fatura.findMany({
      where: { cliente: { agenciaId }, competencia: { gte: primeiro }, status: { not: "CANCELADA" } },
      select: { competencia: true, valor: true, status: true },
    }),
    prisma.despesa.findMany({
      where: { agenciaId, competencia: { gte: primeiro } },
      select: { competencia: true, valor: true, pagoEm: true },
    }),
  ]);

  const mapa = new Map<string, MesDeCaixa>();
  for (let i = 0; i < meses; i++) {
    const c = new Date(Date.UTC(primeiro.getUTCFullYear(), primeiro.getUTCMonth() + i, 1));
    mapa.set(c.toISOString().slice(0, 7), {
      competencia: c,
      rotulo: c.toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }),
      receitaPrevista: 0,
      receitaRecebida: 0,
      despesaLancada: 0,
      despesaPaga: 0,
      saldoPrevisto: 0,
      saldoRealizado: 0,
    });
  }

  for (const f of faturas) {
    const m = mapa.get(f.competencia.toISOString().slice(0, 7));
    if (!m) continue;
    const valor = Number(f.valor);
    m.receitaPrevista += valor;
    if (f.status === "PAGA") m.receitaRecebida += valor;
  }

  for (const d of despesas) {
    const m = mapa.get(d.competencia.toISOString().slice(0, 7));
    if (!m) continue;
    const valor = Number(d.valor);
    m.despesaLancada += valor;
    if (d.pagoEm) m.despesaPaga += valor;
  }

  for (const m of mapa.values()) {
    m.saldoPrevisto = m.receitaPrevista - m.despesaLancada;
    m.saldoRealizado = m.receitaRecebida - m.despesaPaga;
  }

  return [...mapa.values()];
}

/**
 * O custo de cada cliente no mês, e de onde ele veio.
 *
 * Havendo despesa lançada, ela manda: é o que de fato aconteceu. Não havendo,
 * vale o custo mensal combinado no cadastro. A origem volta junto para a tela
 * dizer qual das duas está no número — duas fontes para o mesmo valor, sem
 * dizer qual, é como relatório perde credibilidade.
 */
export async function custoPorCliente(
  agenciaId: string,
  competencia = competenciaDe(),
): Promise<Map<string, { valor: number; origem: "lancado" | "estimado" }>> {
  const [clientes, despesas] = await Promise.all([
    prisma.cliente.findMany({
      where: { agenciaId, ativo: true },
      select: { id: true, custoMensal: true },
    }),
    prisma.despesa.groupBy({
      by: ["clienteId"],
      where: { agenciaId, competencia, clienteId: { not: null } },
      _sum: { valor: true },
    }),
  ]);

  const lancado = new Map(despesas.map((d) => [d.clienteId!, Number(d._sum.valor ?? 0)]));
  const saida = new Map<string, { valor: number; origem: "lancado" | "estimado" }>();

  for (const c of clientes) {
    const real = lancado.get(c.id);
    if (real != null && real > 0) saida.set(c.id, { valor: real, origem: "lancado" });
    else if (c.custoMensal) saida.set(c.id, { valor: Number(c.custoMensal), origem: "estimado" });
  }
  return saida;
}

/**
 * Despesa recorrente do mês novo. Idempotente pela descrição e competência:
 * roda todo dia sem duplicar.
 */
export async function gerarDespesasRecorrentes(competencia = competenciaDe()) {
  const anterior = new Date(Date.UTC(competencia.getUTCFullYear(), competencia.getUTCMonth() - 1, 1));
  const modelos = await prisma.despesa.findMany({
    where: { recorrente: true, competencia: anterior },
    select: { agenciaId: true, clienteId: true, descricao: true, categoria: true, valor: true, vencimento: true },
  });

  let criadas = 0;
  for (const m of modelos) {
    const existe = await prisma.despesa.findFirst({
      where: { agenciaId: m.agenciaId, descricao: m.descricao, competencia },
      select: { id: true },
    });
    if (existe) continue;

    await prisma.despesa.create({
      data: {
        ...m,
        competencia,
        // O vencimento anda junto com o mês, mantendo o dia combinado.
        vencimento: m.vencimento
          ? new Date(Date.UTC(competencia.getUTCFullYear(), competencia.getUTCMonth(), m.vencimento.getUTCDate()))
          : null,
        pagoEm: null,
        recorrente: true,
      },
    });
    criadas++;
  }
  return criadas;
}
