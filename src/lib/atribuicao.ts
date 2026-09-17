import "server-only";
import { prisma } from "./prisma";
import { extrairCodigo, normalizarCodigo } from "./codigo";
import { REGRAS, STATUS_ABERTOS } from "./regras";
import type { Atribuicao, Clique, Lead } from "@prisma/client";

/**
 * Regras 1 a 3 do escopo, sem tocar no banco: dado o texto da mensagem e o
 * horário dela, qual clique responde por este lead.
 */
export async function sugerirClique(params: {
  clienteId: string;
  mensagem?: string | null;
  codigoInformado?: string | null;
  mensagemEm: Date;
}): Promise<{ clique: Clique | null; atribuicao: Atribuicao; codigoLido: string | null }> {
  const { clienteId, mensagem, codigoInformado, mensagemEm } = params;

  const codigo = codigoInformado
    ? normalizarCodigo(codigoInformado)
    : mensagem
      ? extrairCodigo(mensagem)
      : null;

  // Regra 1: código encontrado casa com o clique e a atribuição é exata.
  if (codigo) {
    const clique = await prisma.clique.findUnique({
      where: { clienteId_codigo: { clienteId, codigo } },
      include: { lead: { select: { id: true } } },
    });
    if (clique && !clique.lead) {
      return { clique, atribuicao: "EXATA", codigoLido: codigo };
    }
    // Código digitado errado, ou clique já usado por outro lead: cai na janela.
  }

  // Regra 2: clique pendente mais recente dentro da janela, antes da mensagem.
  const inicio = new Date(mensagemEm.getTime() - REGRAS.janelaAtribuicaoMin * 60 * 1000);
  const provavel = await prisma.clique.findFirst({
    where: {
      clienteId,
      status: "PENDENTE",
      lead: null,
      criadoEm: { gte: inicio, lte: mensagemEm },
    },
    orderBy: { criadoEm: "desc" },
  });
  if (provavel) {
    return { clique: provavel, atribuicao: "PROVAVEL", codigoLido: codigo };
  }

  // Regra 3: sem código e sem clique na janela.
  return { clique: null, atribuicao: "DESCONHECIDA", codigoLido: codigo };
}

type ResultadoCadastro =
  | { tipo: "criado"; lead: Lead }
  | { tipo: "retorno"; lead: Lead }
  | { tipo: "reaberto"; lead: Lead };

/**
 * Regras 4 e 5: telefone repetido não cria lead novo enquanto houver lead aberto
 * ou fechado há pouco tempo. Passado o prazo, é oportunidade nova e precisa
 * receber a atribuição do anúncio novo.
 */
export async function cadastrarLead(params: {
  clienteId: string;
  telefone: string;
  nome?: string | null;
  mensagem?: string | null;
  codigoInformado?: string | null;
  mensagemEm: Date;
  usuarioId: string;
  cliqueIdEscolhido?: string | null;
  atribuicaoEscolhida?: Atribuicao | null;
}): Promise<ResultadoCadastro> {
  const { clienteId, telefone, nome, mensagem, mensagemEm, usuarioId } = params;

  const anterior = await prisma.lead.findFirst({
    where: { clienteId, telefone, arquivadoEm: null },
    orderBy: { criadoEm: "desc" },
  });

  if (anterior) {
    const aberto = (STATUS_ABERTOS as readonly string[]).includes(anterior.status);
    const referencia = anterior.fechadoEm ?? anterior.criadoEm;
    const diasDesde = (Date.now() - referencia.getTime()) / (24 * 60 * 60 * 1000);

    if (aberto || diasDesde <= REGRAS.reabrirLeadDias) {
      // Regra 4: mesmo lead, com evento de retorno. Não conta como lead novo.
      await prisma.evento.create({
        data: {
          clienteId,
          leadId: anterior.id,
          tipo: "RETORNO",
          descricao: mensagem?.slice(0, 500) ?? "Mensagem nova do mesmo telefone",
          usuarioId,
        },
      });
      return { tipo: "retorno", lead: anterior };
    }
  }

  // Atribuição: o atendente pode ter confirmado outro clique na tela de cadastro.
  let cliqueId: string | null = params.cliqueIdEscolhido ?? null;
  let atribuicao: Atribuicao = params.atribuicaoEscolhida ?? "DESCONHECIDA";

  if (!params.cliqueIdEscolhido) {
    const sugestao = await sugerirClique({
      clienteId,
      mensagem,
      codigoInformado: params.codigoInformado,
      mensagemEm,
    });
    cliqueId = sugestao.clique?.id ?? null;
    atribuicao = sugestao.atribuicao;
  }

  const lead = await prisma.$transaction(async (tx) => {
    const criado = await tx.lead.create({
      data: {
        clienteId,
        cliqueId,
        leadAnteriorId: anterior?.id ?? null,
        telefone,
        nome: nome?.trim() || null,
        origem: "MANUAL",
        status: "NOVO",
        atribuicao,
        mensagemEm,
        responsavelId: usuarioId,
      },
    });

    await tx.evento.create({
      data: {
        clienteId,
        leadId: criado.id,
        tipo: "MENSAGEM",
        descricao: mensagem?.slice(0, 500) ?? null,
        usuarioId,
      },
    });

    if (cliqueId) {
      await tx.clique.update({ where: { id: cliqueId }, data: { status: "CASADO" } });
    }

    return criado;
  });

  return { tipo: anterior ? "reaberto" : "criado", lead };
}

/**
 * Regra 12: clique pendente há mais de 24 horas vira clique sem contato.
 * Roda na abertura do painel e na rotina diária; nada é apagado.
 */
export async function encerrarCliquesSemContato(clienteId: string) {
  const limite = new Date(Date.now() - REGRAS.cliqueSemContatoHoras * 60 * 60 * 1000);
  const { count } = await prisma.clique.updateMany({
    where: { clienteId, status: "PENDENTE", criadoEm: { lt: limite } },
    data: { status: "SEM_CONTATO" },
  });
  return count;
}
