/**
 * O teste que um SaaS não pode deixar de ter: duas agências, cada uma com
 * cliente, prospect, proposta, tarefa e fatura, e nenhuma consulta de uma
 * devolvendo qualquer coisa da outra.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { visaoGeral } from "../src/lib/visaoGeral";
import { carteiraComercial, resumoFinanceiro, detalheComercial } from "../src/lib/financeiro";
import { listarProspects } from "../src/lib/prospeccao";
import { listarPropostas, propostaDaAgencia, gerarToken } from "../src/lib/propostas";
import { listarTarefas } from "../src/lib/tarefas";
import { agendaDaSemana } from "../src/lib/agenda";
import { aoMudarEtapa } from "../src/lib/automacoes";
import { clienteDaAgencia } from "../src/lib/auth";
import { hojeComoDataPura } from "../src/lib/datas";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const A = "agencia-iso-a";
const B = "agencia-iso-b";

async function limpar() {
  const clientes = await prisma.cliente.findMany({ where: { agenciaId: { in: [A, B] } }, select: { id: true } });
  const ids = clientes.map((c) => c.id);
  await prisma.tarefa.deleteMany({ where: { agenciaId: { in: [A, B] } } });
  await prisma.fatura.deleteMany({ where: { clienteId: { in: ids } } });
  await prisma.proposta.deleteMany({ where: { clienteId: { in: ids } } });
  await prisma.interacao.deleteMany({ where: { clienteId: { in: ids } } });
  await prisma.cliente.deleteMany({ where: { id: { in: ids } } });
  await prisma.agencia.deleteMany({ where: { id: { in: [A, B] } } });
}

async function popular(agenciaId: string, sufixo: string) {
  await prisma.agencia.create({ data: { id: agenciaId, nome: `Agência ${sufixo}`, slug: agenciaId } });

  const ativo = await prisma.cliente.create({
    data: { id: `cli-${sufixo}`, agenciaId, nome: `Cliente ${sufixo}`, ciclo: "ATIVO", feeMensal: 1000, diaVencimento: 10 },
  });
  const prospect = await prisma.cliente.create({
    data: { id: `pro-${sufixo}`, agenciaId, nome: `Prospect ${sufixo}`, ciclo: "PROSPECCAO" },
  });
  const validade = hojeComoDataPura(undefined, 7);
  const proposta = await prisma.proposta.create({
    data: { clienteId: prospect.id, token: gerarToken(), titulo: `Proposta ${sufixo}`, escopo: [], validade },
  });
  await prisma.tarefa.create({
    data: { agenciaId, titulo: `Tarefa ${sufixo}`, prazo: hojeComoDataPura() },
  });
  await prisma.fatura.create({
    data: {
      clienteId: ativo.id,
      competencia: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)),
      valor: 1000,
      vencimento: hojeComoDataPura(),
    },
  });
  await aoMudarEtapa(prospect.id);
  return { ativo, prospect, proposta };
}

let dadosA: Awaited<ReturnType<typeof popular>>;
let dadosB: Awaited<ReturnType<typeof popular>>;

beforeAll(async () => {
  await limpar();
  dadosA = await popular(A, "A");
  dadosB = await popular(B, "B");
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

const nomes = (lista: { nome?: string; titulo?: string }[]) =>
  lista.map((x) => x.nome ?? x.titulo ?? "").join(" | ");

describe("isolamento entre agências", () => {
  it("clientes: cada agência vê só os seus", async () => {
    const a = await visaoGeral(A, 30);
    expect(nomes(a)).toContain("Cliente A");
    expect(nomes(a)).not.toContain(" B");
  });

  it("financeiro: resumo e carteira não somam a outra agência", async () => {
    const resumo = await resumoFinanceiro(A);
    expect(resumo.receitaRecorrente).toBe(1000);
    expect(resumo.emAberto).toBe(1000);

    const carteira = await carteiraComercial(A);
    expect(carteira.map((c) => c.nome)).not.toContain("Cliente B");
  });

  it("detalhe de cliente de outra agência não abre", async () => {
    expect(await detalheComercial(dadosB.ativo.id, A)).toBeNull();
    expect(await clienteDaAgencia(dadosB.ativo.id, A)).toBeNull();
    expect(await clienteDaAgencia(dadosA.ativo.id, A)).not.toBeNull();
  });

  it("prospecção e propostas", async () => {
    const { lista } = await listarProspects(A);
    expect(lista.map((p) => p.nome)).toEqual(["Prospect A"]);

    const propostas = await listarPropostas(A);
    expect(propostas.map((p) => p.titulo)).toEqual(["Proposta A"]);
    expect(await propostaDaAgencia(dadosB.proposta.id, A)).toBeNull();
  });

  it("tarefas e agenda, incluindo as automáticas", async () => {
    const { hoje, proximas } = await listarTarefas(A);
    const titulos = [...hoje, ...proximas].map((t) => t.titulo);
    expect(titulos).toContain("Tarefa A");
    expect(titulos).toContain("Abordar Prospect A");
    expect(titulos.join(" ")).not.toContain(" B");

    const { dias } = await agendaDaSemana(A, hojeComoDataPura());
    const naAgenda = dias.flatMap((d) => [...d.diaInteiro, ...d.comHorario]).map((i) => i.titulo);
    expect(naAgenda.join(" ")).not.toContain(" B");
  });

  it("tarefa automática nasce na agência do prospect", async () => {
    const t = await prisma.tarefa.findFirst({ where: { clienteId: dadosB.prospect.id } });
    expect(t?.agenciaId).toBe(B);
  });
});

describe("prazo de hoje não é atraso", () => {
  it("tarefa e fatura que vencem hoje ficam em dia", async () => {
    const { hoje, atrasadas } = await listarTarefas(A);
    expect(hoje.map((t) => t.titulo)).toContain("Tarefa A");
    expect(atrasadas.map((t) => t.titulo)).not.toContain("Tarefa A");

    const resumo = await resumoFinanceiro(A);
    expect(resumo.atrasado).toBe(0);
  });
});
