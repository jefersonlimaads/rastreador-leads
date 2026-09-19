/**
 * Lead lançado depois (histórico de um cliente novo) não vai ao Meta como se
 * fosse de hoje. Lead recente vai para a fila normalmente.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { enfileirarEventoCapi } from "../src/lib/meta/capi";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const AG = "agencia-capi-teste";
const C = "cliente-capi-teste";
const DIA = 24 * 60 * 60 * 1000;

async function limpar() {
  await prisma.envioCapi.deleteMany({ where: { clienteId: C } });
  await prisma.lead.deleteMany({ where: { clienteId: C } });
  await prisma.cliente.deleteMany({ where: { id: C } });
  await prisma.agencia.deleteMany({ where: { id: AG } });
}

beforeAll(async () => {
  await limpar();
  await prisma.agencia.create({ data: { id: AG, nome: "Capi Teste", slug: AG } });
  await prisma.cliente.create({ data: { id: C, agenciaId: AG, nome: "Cliente Capi" } });
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("API de Conversões", () => {
  it("lead com mensagem de mais de 7 dias fica registrado como histórico, sem envio", async () => {
    const lead = await prisma.lead.create({
      data: { clienteId: C, telefone: "5511911112222", mensagemEm: new Date(Date.now() - 12 * DIA) },
    });
    const envio = await enfileirarEventoCapi({ leadId: lead.id, tipo: "LEAD" });
    expect(envio?.enviadoEm).toBeNull();
    expect(envio?.tentativas).toBe(5);
    expect(envio?.resposta).toMatch(/histórico/);
  });

  it("lead recente entra na fila para envio", async () => {
    const lead = await prisma.lead.create({
      data: { clienteId: C, telefone: "5511933334444", mensagemEm: new Date(Date.now() - 2 * DIA) },
    });
    const envio = await enfileirarEventoCapi({ leadId: lead.id, tipo: "LEAD" });
    expect(envio?.tentativas).toBe(1);
    const gravado = await prisma.envioCapi.findUnique({ where: { id: envio!.id } });
    expect(gravado?.resposta).toMatch(/sem pixelId/);
  });
});
