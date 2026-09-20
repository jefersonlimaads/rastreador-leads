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

  const [clientes, doMes, abertas] = await Promise.all([
    prisma.cliente.findMany({
      where: { agenciaId, ativo: true },
      select: { ciclo: true, feeMensal: true, custoMensal: true },
    }),
    prisma.fatura.findMany({
      where: { competencia, cliente: { agenciaId } },
      select: { valor: true, status: true },
    }),
    prisma.fatura.findMany({
      where: { status: "ABERTA", cliente: { agenciaId } },
      select: { valor: true, vencimento: true },
    }),
  ]);

  const soma = (lista: { valor: unknown }[]) =>
    lista.reduce((t, f) => t + Number(f.valor), 0);

  const vencidas = abertas.filter((f) => f.vencimento < hoje);

  const ativos = clientes.filter((c) => c.ciclo === "ATIVO");
  const receitaRecorrente = ativos.reduce((t, c) => t + Number(c.feeMensal ?? 0), 0);
  const custoDireto = ativos.reduce((t, c) => t + Number(c.custoMensal ?? 0), 0);

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

  const clientes = await prisma.cliente.findMany({
    where: { agenciaId, ativo: true },
    orderBy: [{ ciclo: "asc" }, { nome: "asc" }],
    include: {
      faturas: { orderBy: { competencia: "desc" }, take: 3 },
      _count: { select: { leads: true } },
    },
  });

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
      custoMensal: c.custoMensal ? Number(c.custoMensal) : null,
      // Margem só existe quando há fee: sem os dois números, ela seria chute.
      margem: c.feeMensal ? Number(c.feeMensal) - Number(c.custoMensal ?? 0) : null,
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
