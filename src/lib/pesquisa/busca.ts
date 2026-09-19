import "server-only";
import { prisma } from "../prisma";
import { normalizarTelefone } from "../telefone";
import { createHash } from "node:crypto";
import { buscarNoGoogle, googleConfigurado, type EmpresaGoogle } from "./google";
import { buscarNoOsm } from "./osm";
import type { LinhaLista } from "./lista";
import { baixarSite, type SinaisSite } from "./site";
import { qualificarPorRegra, type DadosProspect } from "./qualificar";
import { qualificarComIa } from "./ia";

/**
 * Prospecção automática: busca no Google, diagnostica cada empresa e põe em
 * "A abordar" quem passa da nota mínima.
 *
 * A busca no Google é rápida e acontece na hora. A análise (site + IA) leva de
 * 5 a 20 segundos por empresa: roda em lotes, em segundo plano, e cada empresa
 * é "reservada" antes de ser analisada — se a função for interrompida no meio,
 * quem retomar continua de onde parou, sem analisar nada duas vezes.
 */

export const MAX_QUANTIDADE = 30;
const LOTE = 5;
/** Folga antes do limite de 300 s da função: não começa lote que não vai terminar. */
const ORCAMENTO_MS = 230_000;
/** Reserva velha (função que morreu no meio) volta para a fila. */
const RESERVA_EXPIRA_MS = 4 * 60_000;

export type ParametrosBusca = {
  agenciaId: string;
  nicho: string;
  cidade: string;
  quantidade: number;
  notaMinima: number;
};

export async function iniciarBusca(p: ParametrosBusca): Promise<{ buscaId: string } | { erro: string }> {
  const quantidade = Math.max(1, Math.min(MAX_QUANTIDADE, Math.round(p.quantidade)));
  // Google quando houver chave (mais completo); senão, o mapa aberto, grátis.
  // Pede mais do que precisa: as empresas que você já tem saem da conta.
  const fonte = googleConfigurado() ? "google" : "osm";
  const resultado =
    fonte === "google"
      ? await buscarNoGoogle(`${p.nicho} em ${p.cidade}`, Math.min(60, quantidade + 20))
      : await buscarNoOsm(p.nicho, p.cidade, quantidade + 40);
  if ("erro" in resultado) return { erro: resultado.erro };
  return registrarBusca(p, fonte, resultado.empresas, quantidade);
}

/**
 * Lista colada: cada linha vira uma empresa para analisar. Sem busca externa,
 * então o "id do lugar" é uma impressão digital do nome + telefone — colar a
 * mesma empresa duas vezes não duplica.
 */
export async function iniciarBuscaPorLista(
  p: Omit<ParametrosBusca, "quantidade">,
  linhas: LinhaLista[],
): Promise<{ buscaId: string } | { erro: string }> {
  if (linhas.length === 0) return { erro: "Não encontrei nenhuma empresa na lista." };
  const empresas: (EmpresaGoogle & { instagram?: string | null })[] = linhas.map((l) => ({
    placeId: `lista:${createHash("sha1").update(`${l.nome.toLowerCase()}|${(l.telefone ?? "").replace(/\D/g, "")}`).digest("hex").slice(0, 20)}`,
    nome: l.nome,
    categoria: null,
    telefone: l.telefone,
    site: l.site ?? (l.instagram ? `https://instagram.com/${l.instagram}` : null),
    endereco: null,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${l.nome} ${p.cidade}`)}`,
    nota: null,
    avaliacoes: null,
    instagram: l.instagram,
  }));
  return registrarBusca({ ...p, quantidade: empresas.length }, "lista", empresas, empresas.length);
}

async function registrarBusca(
  p: ParametrosBusca,
  fonte: string,
  todas: (EmpresaGoogle & { instagram?: string | null })[],
  quantidade: number,
): Promise<{ buscaId: string }> {
  const resultado = { empresas: todas };

  // Já pesquisadas antes (inclusive as descartadas) e já cadastradas pelo telefone.
  const [conhecidas, clientes] = await Promise.all([
    prisma.diagnostico.findMany({
      where: { agenciaId: p.agenciaId, placeId: { in: resultado.empresas.map((e) => e.placeId) } },
      select: { placeId: true },
    }),
    prisma.cliente.findMany({
      where: { agenciaId: p.agenciaId },
      select: { contatoTelefone: true, numeros: { select: { numero: true } } },
    }),
  ]);
  const placeIds = new Set(conhecidas.map((c) => c.placeId));
  const telefones = new Set(
    clientes.flatMap((c) => [c.contatoTelefone, ...c.numeros.map((n) => n.numero)]).filter(Boolean),
  );
  const novas = resultado.empresas
    .filter((e) => !placeIds.has(e.placeId))
    .filter((e) => {
      const tel = e.telefone ? normalizarTelefone(e.telefone) : null;
      return !tel || !telefones.has(tel);
    })
    .slice(0, quantidade);

  const busca = await prisma.buscaProspeccao.create({
    data: {
      agenciaId: p.agenciaId,
      nicho: p.nicho,
      cidade: p.cidade,
      quantidade,
      notaMinima: p.notaMinima,
      fonte,
      encontrados: novas.length,
      status: novas.length === 0 ? "CONCLUIDA" : "RODANDO",
      concluidaEm: novas.length === 0 ? new Date() : null,
      erro: novas.length === 0 ? "Nenhuma empresa nova: as encontradas você já tem ou já pesquisou antes." : null,
    },
  });

  if (novas.length) {
    await prisma.diagnostico.createMany({
      data: novas.map((e) => ({
        agenciaId: p.agenciaId,
        buscaId: busca.id,
        placeId: e.placeId,
        nome: e.nome,
        categoria: e.categoria,
        telefone: e.telefone,
        site: e.site,
        endereco: e.endereco,
        mapsUrl: e.mapsUrl,
        notaGoogle: e.nota,
        avaliacoes: e.avaliacoes,
        instagram: e.instagram ?? null,
      })),
      skipDuplicates: true,
    });
  }
  return { buscaId: busca.id };
}

/** Analisa o que estiver na fila desta busca, até o orçamento de tempo acabar. */
export async function processarBusca(buscaId: string, quem: { assinatura: string; agencia: string }) {
  const inicio = Date.now();
  const busca = await prisma.buscaProspeccao.findUnique({ where: { id: buscaId } });
  if (!busca || busca.status !== "RODANDO") return;

  // Reserva que ficou para trás de uma execução interrompida volta para a fila.
  await prisma.diagnostico.updateMany({
    where: { buscaId, status: "ANALISANDO", analisadoEm: { lt: new Date(Date.now() - RESERVA_EXPIRA_MS) } },
    data: { status: "PENDENTE" },
  });

  while (Date.now() - inicio < ORCAMENTO_MS) {
    const fila = await prisma.diagnostico.findMany({
      where: { buscaId, status: "PENDENTE" },
      take: LOTE,
      orderBy: { criadoEm: "asc" },
    });
    if (fila.length === 0) break;

    await Promise.all(
      fila.map(async (item) => {
        // Reserva: se outra execução pegou antes, esta pula.
        const { count } = await prisma.diagnostico.updateMany({
          where: { id: item.id, status: "PENDENTE" },
          data: { status: "ANALISANDO", analisadoEm: new Date() },
        });
        if (count === 0) return;
        try {
          await analisarUm(item.id, busca, quem);
        } catch (erro) {
          await prisma.diagnostico.update({
            where: { id: item.id },
            data: { status: "ERRO", erro: String(erro).slice(0, 300) },
          });
          await prisma.buscaProspeccao.update({ where: { id: buscaId }, data: { analisados: { increment: 1 } } });
        }
      }),
    );
  }

  const restantes = await prisma.diagnostico.count({
    where: { buscaId, status: { in: ["PENDENTE", "ANALISANDO"] } },
  });
  if (restantes === 0) {
    await prisma.buscaProspeccao.update({
      where: { id: buscaId },
      data: { status: "CONCLUIDA", concluidaEm: new Date() },
    });
  }
}

async function analisarUm(
  id: string,
  busca: { id: string; agenciaId: string; nicho: string; cidade: string; notaMinima: number; fonte: string },
  quem: { assinatura: string; agencia: string },
) {
  const item = await prisma.diagnostico.findUniqueOrThrow({ where: { id } });
  const sinais: SinaisSite = await baixarSite(item.site);
  const dados: DadosProspect = {
    nome: item.nome,
    nicho: busca.nicho,
    cidade: busca.cidade,
    categoria: item.categoria,
    telefone: item.telefone,
    site: item.site,
    notaGoogle: item.notaGoogle,
    avaliacoes: item.avaliacoes,
    instagram: sinais.instagram ?? item.instagram,
    sinais,
  };
  const porRegra = qualificarPorRegra(dados, quem.assinatura);
  const porIa = await qualificarComIa(dados, porRegra, quem);
  const q = porIa ?? porRegra;
  const entra = q.pontuacao >= busca.notaMinima;

  await prisma.$transaction(async (tx) => {
    let clienteId: string | null = null;
    if (entra) clienteId = await criarProspect(tx, busca, item, { ...sinais, instagram: sinais.instagram ?? item.instagram });
    await tx.diagnostico.update({
      where: { id },
      data: {
        instagram: sinais.instagram ?? item.instagram,
        facebook: sinais.facebook,
        sinais,
        pontuacao: q.pontuacao,
        resumo: q.resumo,
        gaps: q.gaps,
        briefing: q.briefing,
        mensagem: q.mensagem,
        analisadoPorIa: Boolean(porIa),
        status: entra ? "ANALISADO" : "DESCARTADO",
        analisadoEm: new Date(),
        clienteId,
      },
    });
    await tx.buscaProspeccao.update({
      where: { id: busca.id },
      data: { analisados: { increment: 1 }, ...(entra ? { adicionados: { increment: 1 } } : {}) },
    });
  });
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * O prospect entra direto em "A abordar", sem a tarefa automática de abordar:
 * trinta de uma vez soterrariam a lista de tarefas, e a coluna já é a fila.
 */
async function criarProspect(
  tx: Tx,
  busca: { agenciaId: string; nicho: string; fonte?: string },
  item: { nome: string; telefone: string | null; site: string | null },
  sinais: SinaisSite,
) {
  const p = await tx.cliente.create({
    data: {
      agenciaId: busca.agenciaId,
      nome: item.nome,
      ciclo: "PROSPECCAO",
      nicho: busca.nicho,
      origem: busca.fonte === "lista" ? "Lista importada" : "Busca automática",
      contatoTelefone: item.telefone ? normalizarTelefone(item.telefone) : null,
      site: item.site,
      instagram: sinais.instagram,
    },
  });
  return p.id;
}

/** Promover um descartado: você discordou da nota. */
export async function promoverDiagnostico(id: string, agenciaId: string) {
  const d = await prisma.diagnostico.findFirst({
    where: { id, agenciaId, clienteId: null },
    include: { busca: true },
  });
  if (!d) return null;
  return prisma.$transaction(async (tx) => {
    const clienteId = await criarProspect(
      tx,
      { agenciaId, nicho: d.busca?.nicho ?? d.categoria ?? "Prospect", fonte: d.busca?.fonte },
      d,
      (d.sinais as SinaisSite | null) ?? ({ instagram: d.instagram } as SinaisSite),
    );
    await tx.diagnostico.update({ where: { id }, data: { clienteId, status: "ANALISADO" } });
    if (d.buscaId) {
      await tx.buscaProspeccao.update({ where: { id: d.buscaId }, data: { adicionados: { increment: 1 } } });
    }
    return clienteId;
  });
}
