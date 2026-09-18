/**
 * Tarefas automáticas por etapa: prazo certo, sem duplicar, e a da etapa
 * anterior se conclui quando o prospect avança.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { aoMudarEtapa } from "../src/lib/automacoes";
import { registrarInteracao } from "../src/lib/prospeccao";
import { hojeComoDataPura, instanteLocal } from "../src/lib/datas";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ID = "prospect-automacao-teste";
const dia = (n: number) => hojeComoDataPura(undefined, n).toISOString().slice(0, 10);

async function limpar() {
  await prisma.tarefa.deleteMany({ where: { clienteId: ID } });
  await prisma.interacao.deleteMany({ where: { clienteId: ID } });
  await prisma.cliente.deleteMany({ where: { id: ID } });
}

async function abertas() {
  return prisma.tarefa.findMany({ where: { clienteId: ID, status: "ABERTA" }, orderBy: { prazo: "asc" } });
}

beforeEach(async () => {
  await limpar();
  await prisma.cliente.create({
    data: { id: ID, agenciaId: "agencia-jlads", nome: "Ótica Visão", ciclo: "PROSPECCAO" },
  });
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("tarefas automáticas", () => {
  it("a abordar gera tarefa em 7 dias", async () => {
    await aoMudarEtapa(ID);
    const t = await abertas();
    expect(t).toHaveLength(1);
    expect(t[0].titulo).toBe("Abordar Ótica Visão");
    expect(t[0].prazo?.toISOString().slice(0, 10)).toBe(dia(7));
    expect(t[0].automatica).toBe(true);
  });

  it("chamar de novo não duplica", async () => {
    await aoMudarEtapa(ID);
    await aoMudarEtapa(ID);
    expect(await abertas()).toHaveLength(1);
  });

  it("avançar conclui a tarefa da etapa anterior", async () => {
    await aoMudarEtapa(ID);
    await registrarInteracao({ clienteId: ID, tipo: "MENSAGEM", descricao: "Abordei", novaEtapa: "ABORDADO" });

    expect(await abertas()).toHaveLength(0);
    const feita = await prisma.tarefa.findFirst({ where: { clienteId: ID, titulo: "Abordar Ótica Visão" } });
    expect(feita?.status).toBe("FEITA");
  });

  it("reunião marcada entra na agenda no horário e gera a proposta para o dia seguinte", async () => {
    const reuniao = instanteLocal(2026, 10, 5, 15, 0);
    await registrarInteracao({
      clienteId: ID,
      tipo: "MENSAGEM",
      descricao: "Marcamos",
      novaEtapa: "REUNIAO_MARCADA",
      reuniaoEm: reuniao,
    });

    const t = await abertas();
    const r = t.find((x) => x.titulo === "Reunião com Ótica Visão");
    const p = t.find((x) => x.titulo === "Enviar proposta para Ótica Visão");

    expect(r?.inicio?.toISOString()).toBe(reuniao.toISOString());
    expect(r?.duracaoMin).toBe(60);
    expect(r?.prazo?.toISOString().slice(0, 10)).toBe("2026-10-05");
    expect(p?.prazo?.toISOString().slice(0, 10)).toBe("2026-10-06");
  });

  it("remarcar a reunião move a tarefa, sem criar outra", async () => {
    await registrarInteracao({
      clienteId: ID, tipo: "MENSAGEM", descricao: "Marcamos",
      novaEtapa: "REUNIAO_MARCADA", reuniaoEm: instanteLocal(2026, 10, 5, 15, 0),
    });
    const nova = instanteLocal(2026, 10, 7, 9, 30);
    await registrarInteracao({
      clienteId: ID, tipo: "MENSAGEM", descricao: "Remarcou",
      novaEtapa: "REUNIAO_MARCADA", reuniaoEm: nova,
    });

    const reunioes = (await abertas()).filter((x) => x.chave === "etapa:REUNIAO_MARCADA");
    expect(reunioes).toHaveLength(1);
    expect(reunioes[0].inicio?.toISOString()).toBe(nova.toISOString());
  });

  it("proposta enviada e negociando cobram em 48h", async () => {
    await prisma.cliente.update({ where: { id: ID }, data: { ciclo: "PROPOSTA_ENVIADA" } });
    await aoMudarEtapa(ID);
    let t = await abertas();
    expect(t.map((x) => x.titulo)).toEqual(["Acompanhar proposta de Ótica Visão"]);
    expect(t[0].prazo?.toISOString().slice(0, 10)).toBe(dia(2));

    await prisma.cliente.update({ where: { id: ID }, data: { ciclo: "NEGOCIANDO" } });
    await aoMudarEtapa(ID);
    t = await abertas();
    expect(t.map((x) => x.titulo)).toEqual(["Retomar negociação com Ótica Visão"]);
  });

  it("virar cliente encerra as tarefas de prospecção, mas não as suas", async () => {
    await aoMudarEtapa(ID);
    await prisma.tarefa.create({
      data: { agenciaId: "agencia-jlads", clienteId: ID, titulo: "Minha tarefa manual" },
    });

    await prisma.cliente.update({ where: { id: ID }, data: { ciclo: "ATIVO" } });
    await aoMudarEtapa(ID);

    const t = await abertas();
    expect(t.map((x) => x.titulo)).toEqual(["Minha tarefa manual"]);
  });
});
