/**
 * Relatório para o cliente: o período é de dias de São Paulo, não de UTC.
 * Lead das 23h do último dia entra; o da meia-noite e meia do dia seguinte,
 * não. Gasto do dia seguinte também não.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { lerDia, montarRelatorio, validarPeriodo } from "../src/lib/relatorio";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const AG = "agencia-rel-teste";
const C = "cliente-rel-teste";

async function limpar() {
  await prisma.lead.deleteMany({ where: { clienteId: C } });
  await prisma.clique.deleteMany({ where: { clienteId: C } });
  await prisma.gasto.deleteMany({ where: { clienteId: C } });
  await prisma.cliente.deleteMany({ where: { id: C } });
  await prisma.agencia.deleteMany({ where: { id: AG } });
}

const lead = (criadoEm: string, status: "NOVO" | "FECHADO" = "NOVO", valor?: number) =>
  prisma.lead.create({
    data: {
      clienteId: C,
      criadoEm: new Date(criadoEm),
      mensagemEm: new Date(criadoEm),
      status,
      valorVenda: valor ?? null,
    },
  });

const gasto = (dia: string, valor: number) =>
  prisma.gasto.create({
    data: { clienteId: C, adId: "ad-" + dia, dia: new Date(dia + "T00:00:00Z"), valor },
  });

beforeAll(async () => {
  await limpar();
  await prisma.agencia.create({ data: { id: AG, nome: "Rel Teste", slug: AG } });
  await prisma.cliente.create({ data: { id: C, agenciaId: AG, nome: "Cliente Rel" } });

  // Período: 1 a 30 de setembro. Anterior: 2 a 31 de agosto.
  await lead("2026-09-01T03:10:00Z"); // 01/09 00:10 em SP: entra
  await lead("2026-10-01T02:30:00Z", "FECHADO", 1000); // 30/09 23:30 em SP: entra
  await lead("2026-10-01T03:30:00Z"); // 01/10 00:30 em SP: fora
  await lead("2026-09-01T02:00:00Z"); // 31/08 23:00 em SP: período anterior
  await gasto("2026-09-01", 100);
  await gasto("2026-09-30", 100);
  await gasto("2026-10-01", 999); // dia seguinte: fora
  await gasto("2026-08-31", 50); // período anterior
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("relatório", () => {
  it("conta leads e gasto pelos dias de São Paulo", async () => {
    const r = await montarRelatorio(C, lerDia("2026-09-01")!, lerDia("2026-09-30")!);
    expect(r).not.toBeNull();
    expect(r!.periodo.dias).toBe(30);
    expect(r!.atual.leads).toBe(2);
    expect(r!.atual.investimento).toBe(200);
    expect(r!.atual.fechados).toBe(1);
    expect(r!.atual.receita).toBe(1000);
    expect(r!.atual.cpl).toBe(100);
    expect(r!.atual.roas).toBe(5);
  });

  it("compara com o período anterior de mesmo tamanho", async () => {
    const r = await montarRelatorio(C, lerDia("2026-09-01")!, lerDia("2026-09-30")!);
    expect(r!.anterior.de).toBe("2026-08-02");
    expect(r!.anterior.ate).toBe("2026-08-31");
    expect(r!.anterior.totais.leads).toBe(1);
    expect(r!.anterior.totais.investimento).toBe(50);
  });

  it("série diária tem todos os dias, com o lead da noite no dia certo", async () => {
    const r = await montarRelatorio(C, lerDia("2026-09-01")!, lerDia("2026-09-30")!);
    expect(r!.porDia).toHaveLength(30);
    expect(r!.porDia.at(-1)).toEqual({ dia: "2026-09-30", investimento: 100, leads: 1 });
    expect(r!.porDia[0]).toEqual({ dia: "2026-09-01", investimento: 100, leads: 1 });
  });

  it("valida o período", () => {
    expect(validarPeriodo("2026-09-30", "2026-09-01")).toHaveProperty("erro");
    expect(validarPeriodo("2026-02-30", "2026-03-01")).toHaveProperty("erro");
    expect(validarPeriodo("2025-01-01", "2026-09-01")).toHaveProperty("erro");
    expect(validarPeriodo("2026-09-01", "2026-09-01")).not.toHaveProperty("erro");
  });
});
