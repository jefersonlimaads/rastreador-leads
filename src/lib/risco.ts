import "server-only";
import { prisma } from "./prisma";
import { FUSO_PADRAO, hojeComoDataPura } from "./datas";

/**
 * Risco de cancelamento.
 *
 * Cliente não cancela de surpresa: ele avisa antes, em sinais que ninguém
 * junta. Resultado caindo, ninguém respondendo os leads, fatura atrasada,
 * relatório que não foi aberto, contrato vencendo. Cada um desses é suportável
 * sozinho; dois ou três juntos são uma conversa que vai acontecer — melhor que
 * aconteça no seu tempo.
 *
 * Tudo aqui sai de dado que o sistema já tem. Nada de pesquisa de satisfação:
 * o cliente insatisfeito raramente responde formulário, mas sempre aparece nos
 * números.
 */

export type SinalRisco = {
  chave: string;
  texto: string;
  /** Peso do sinal: soma vira o nível. */
  peso: number;
  acao: string;
};

export type RiscoCliente = {
  clienteId: string;
  nome: string;
  pontos: number;
  nivel: "ok" | "atencao" | "alto";
  sinais: SinalRisco[];
};

const DIA_MS = 24 * 60 * 60 * 1000;

/** A partir de 3 pontos há algo a fazer; de 6 em diante, é conversa marcada. */
const ATENCAO = 3;
const ALTO = 6;

export async function riscoDoCliente(clienteId: string, fuso = FUSO_PADRAO): Promise<RiscoCliente | null> {
  const agora = new Date();
  const hoje = hojeComoDataPura(fuso);
  const de30 = new Date(agora.getTime() - 30 * DIA_MS);
  const de60 = new Date(agora.getTime() - 60 * DIA_MS);
  const de7 = new Date(agora.getTime() - 7 * DIA_MS);

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { id: true, nome: true, ciclo: true, fimContrato: true },
  });
  if (!cliente) return null;

  const [leads30, leads60, semResposta, faturasAtrasadas, ultimoRelatorio, gasto30, gasto60] =
    await Promise.all([
      prisma.lead.count({ where: { clienteId, arquivadoEm: null, criadoEm: { gte: de30 } } }),
      prisma.lead.count({
        where: { clienteId, arquivadoEm: null, criadoEm: { gte: de60, lt: de30 } },
      }),
      // Leads da última semana que ninguém tocou: é o que o cliente mais sente.
      prisma.lead.count({
        where: {
          clienteId,
          arquivadoEm: null,
          criadoEm: { gte: de7 },
          eventos: { none: { tipo: { in: ["CONTATO", "MUDANCA_STATUS", "NOTA"] } } },
        },
      }),
      prisma.fatura.count({ where: { clienteId, status: "ABERTA", vencimento: { lt: hoje } } }),
      prisma.relatorio.findFirst({
        where: { clienteId },
        orderBy: { criadoEm: "desc" },
        select: { criadoEm: true, visualizacoes: true },
      }),
      prisma.gasto.aggregate({
        where: { clienteId, dia: { gte: new Date(de30.toISOString().slice(0, 10)) } },
        _sum: { valor: true },
      }),
      prisma.gasto.aggregate({
        where: {
          clienteId,
          dia: {
            gte: new Date(de60.toISOString().slice(0, 10)),
            lt: new Date(de30.toISOString().slice(0, 10)),
          },
        },
        _sum: { valor: true },
      }),
    ]);

  const sinais: SinalRisco[] = [];

  // 1. Resultado caindo, com base de comparação de verdade.
  if (leads60 >= 5 && leads30 <= leads60 * 0.6) {
    const queda = Math.round((1 - leads30 / leads60) * 100);
    sinais.push({
      chave: "queda",
      peso: 3,
      texto: `Contatos caíram ${queda}%: ${leads30} nos últimos 30 dias contra ${leads60} nos 30 anteriores.`,
      acao: "Leve o motivo da queda para a próxima conversa antes que ele pergunte.",
    });
  }

  // 2. Verba caindo é o aviso mais honesto que existe: o cliente já decidiu testar sem você.
  const g30 = Number(gasto30._sum.valor ?? 0);
  const g60 = Number(gasto60._sum.valor ?? 0);
  if (g60 > 0 && g30 <= g60 * 0.6) {
    sinais.push({
      chave: "verba",
      peso: 3,
      texto: `Investimento caiu ${Math.round((1 - g30 / g60) * 100)}% em relação ao mês anterior.`,
      acao: "Pergunte direto o que mudou no planejamento dele. Verba que cai sozinha costuma voltar como cancelamento.",
    });
  }

  // 3. Lead parado: o cliente paga por contato e ninguém fala com ele.
  if (semResposta >= 3) {
    sinais.push({
      chave: "sem_resposta",
      peso: 2,
      texto: `${semResposta} contatos da última semana sem ninguém ter registrado atendimento.`,
      acao: "Mostre a lista para ele. A conta some quando o problema aparece nomeado.",
    });
  }

  // 4. Dinheiro: atraso repetido é insatisfação que ainda não virou frase.
  if (faturasAtrasadas > 0) {
    sinais.push({
      chave: "fatura",
      peso: faturasAtrasadas >= 2 ? 3 : 2,
      texto: `${faturasAtrasadas} ${faturasAtrasadas === 1 ? "fatura atrasada" : "faturas atrasadas"}.`,
      acao: "Cobre com o relatório junto: a conversa muda quando o resultado está na mesma tela.",
    });
  }

  // 5. Silêncio: sem relatório recente, só sobra a percepção dele.
  const diasSemRelatorio = ultimoRelatorio
    ? Math.floor((agora.getTime() - ultimoRelatorio.criadoEm.getTime()) / DIA_MS)
    : null;
  if (diasSemRelatorio == null) {
    sinais.push({
      chave: "sem_relatorio",
      peso: 2,
      texto: "Nenhum relatório enviado até hoje.",
      acao: "Gere o primeiro. Cliente sem relatório julga o trabalho pelo que lembra.",
    });
  } else if (diasSemRelatorio > 45) {
    sinais.push({
      chave: "relatorio_velho",
      peso: 2,
      texto: `Último relatório há ${diasSemRelatorio} dias.`,
      acao: "Mande o do mês fechado: o link já é gerado automaticamente todo dia 1.",
    });
  } else if (ultimoRelatorio!.visualizacoes === 0 && diasSemRelatorio >= 7) {
    sinais.push({
      chave: "relatorio_fechado",
      peso: 1,
      texto: `O último relatório foi enviado há ${diasSemRelatorio} dias e nunca foi aberto.`,
      acao: "Ligue e passe os números por voz. Relatório não lido não vale como comunicação.",
    });
  }

  // 6. Contrato vencendo sem conversa marcada.
  if (cliente.fimContrato) {
    const dias = Math.round((cliente.fimContrato.getTime() - hoje.getTime()) / DIA_MS);
    if (dias <= 30) {
      sinais.push({
        chave: "contrato",
        peso: dias <= 0 ? 3 : 2,
        texto:
          dias <= 0
            ? "O contrato venceu e não há renovação registrada."
            : `Contrato vence em ${dias} ${dias === 1 ? "dia" : "dias"}.`,
        acao: "Marque a conversa de renovação com o relatório do período inteiro na mão.",
      });
    }
  }

  const pontos = sinais.reduce((s, x) => s + x.peso, 0);

  return {
    clienteId: cliente.id,
    nome: cliente.nome,
    pontos,
    nivel: pontos >= ALTO ? "alto" : pontos >= ATENCAO ? "atencao" : "ok",
    sinais: sinais.sort((a, b) => b.peso - a.peso),
  };
}

/** A carteira inteira, do mais arriscado para o menos. Só quem tem sinal aparece. */
export async function riscosDaCarteira(agenciaId: string, fuso = FUSO_PADRAO) {
  const clientes = await prisma.cliente.findMany({
    where: { agenciaId, ativo: true, ciclo: "ATIVO" },
    select: { id: true },
  });

  const riscos = await Promise.all(clientes.map((c) => riscoDoCliente(c.id, fuso)));
  return riscos
    .filter((r): r is RiscoCliente => r != null && r.sinais.length > 0)
    .sort((a, b) => b.pontos - a.pontos);
}
