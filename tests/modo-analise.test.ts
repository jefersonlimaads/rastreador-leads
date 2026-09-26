/**
 * Coorte × período: a mesma venda pertence a meses diferentes conforme a
 * pergunta. Misturar os dois produz relatório errado sem ninguém perceber.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { metricasPorAnuncio } from "../src/lib/metricas";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const AG = "agencia-modo-teste";
const C = "cliente-modo-teste";

// Agosto e setembro de 2026, datas puras para não depender do relógio.
const AGO_1 = new Date("2026-08-01T12:00:00Z");
const SET_1 = new Date("2026-09-01T00:00:00Z");
const SET_10 = new Date("2026-09-10T12:00:00Z");
const SET_20 = new Date("2026-09-20T12:00:00Z");
const SET_30 = new Date("2026-09-30T23:59:59Z");

async function limpar() {
  await prisma.gasto.deleteMany({ where: { clienteId: C } });
  await prisma.lead.deleteMany({ where: { clienteId: C } });
  await prisma.cliente.deleteMany({ where: { id: C } });
  await prisma.agencia.deleteMany({ where: { id: AG } });
}

beforeAll(async () => {
  await limpar();
  await prisma.agencia.create({ data: { id: AG, nome: "Modo", slug: AG } });
  await prisma.cliente.create({ data: { id: C, agenciaId: AG, nome: "Cliente Modo" } });

  // Lead de agosto que fechou em setembro: o caso que separa os dois modos.
  await prisma.lead.create({
    data: {
      clienteId: C, telefone: "5519900000001", mensagemEm: AGO_1, criadoEm: AGO_1,
      status: "FECHADO", valorVenda: 5000, fechadoEm: SET_20,
    },
  });
  // Lead de setembro que fechou em setembro: conta nos dois.
  await prisma.lead.create({
    data: {
      clienteId: C, telefone: "5519900000002", mensagemEm: SET_10, criadoEm: SET_10,
      status: "FECHADO", valorVenda: 3000, fechadoEm: SET_20,
    },
  });
  // Lead de setembro ainda em aberto.
  await prisma.lead.create({
    data: {
      clienteId: C, telefone: "5519900000003", mensagemEm: SET_10, criadoEm: SET_10,
      status: "EM_ATENDIMENTO",
    },
  });
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("modo de análise", () => {
  it("coorte conta só as vendas dos contatos que chegaram no período", async () => {
    const r = await metricasPorAnuncio({ clienteId: C, de: SET_1, ate: SET_30, modo: "coorte" });
    expect(r.total.leads).toBe(2); // os dois de setembro
    expect(r.total.fechados).toBe(1); // só o de setembro que fechou
    expect(r.total.receita).toBe(3000); // a venda de agosto não é desta campanha
    expect(r.emAberto).toBe(1);
  });

  it("período conta toda venda fechada no mês, venha o contato de quando vier", async () => {
    const r = await metricasPorAnuncio({ clienteId: C, de: SET_1, ate: SET_30, modo: "periodo" });
    expect(r.total.leads).toBe(2); // chegada não muda: continua sendo do período
    expect(r.total.fechados).toBe(2); // a de agosto entra, porque fechou agora
    expect(r.total.receita).toBe(8000);
  });

  it("o modo volta na resposta, para a tela dizer o que está mostrando", async () => {
    const r = await metricasPorAnuncio({ clienteId: C, de: SET_1, ate: SET_30 });
    expect(r.modo).toBe("coorte"); // o padrão julga campanha
  });
});
