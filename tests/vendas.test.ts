/**
 * Vendas por lead: o mesmo cliente compra mais de uma vez, e esse faturamento
 * veio da mesma mídia. Um contato, um cliente, várias vendas.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { apagarVenda, registrarVenda, vendasDoLead } from "../src/lib/vendas";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const AG = "agencia-vendas-teste";
const C = "cliente-vendas-teste";
const L = "lead-vendas-teste";

async function limpar() {
  await prisma.venda.deleteMany({ where: { clienteId: C } });
  await prisma.evento.deleteMany({ where: { clienteId: C } });
  await prisma.lead.deleteMany({ where: { clienteId: C } });
  await prisma.cliente.deleteMany({ where: { id: C } });
  await prisma.agencia.deleteMany({ where: { id: AG } });
}

beforeEach(async () => {
  await limpar();
  await prisma.agencia.create({ data: { id: AG, nome: "Vendas Teste", slug: AG } });
  await prisma.cliente.create({ data: { id: C, agenciaId: AG, nome: "Cliente Vendas" } });
  await prisma.lead.create({
    data: { id: L, clienteId: C, telefone: "5519911110000", mensagemEm: new Date(), status: "EM_ATENDIMENTO" },
  });
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("vendas do lead", () => {
  it("soma as vendas no total do lead, que é o que os relatórios leem", async () => {
    await registrarVenda({ leadId: L, clienteId: C, valor: 2000, descricao: "Primeiro serviço" });
    const depoisDaPrimeira = await prisma.lead.findUniqueOrThrow({ where: { id: L } });
    expect(Number(depoisDaPrimeira.valorVenda)).toBe(2000);

    const { total, quantas } = await registrarVenda({ leadId: L, clienteId: C, valor: 1500, descricao: "Segundo serviço" });
    expect(total).toBe(3500);
    expect(quantas).toBe(2);

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: L } });
    expect(Number(lead.valorVenda)).toBe(3500);

    const vendas = await vendasDoLead(L);
    expect(vendas.map((v) => v.descricao)).toEqual(["Primeiro serviço", "Segundo serviço"]);
  });

  it("a segunda venda vira evento próprio, com o total", async () => {
    await registrarVenda({ leadId: L, clienteId: C, valor: 2000 });
    await registrarVenda({ leadId: L, clienteId: C, valor: 1500, descricao: "Segundo serviço" });

    const eventos = await prisma.evento.findMany({ where: { leadId: L }, orderBy: { criadoEm: "asc" } });
    expect(eventos[0].descricao).toMatch(/^Fechado por/);
    expect(eventos[1].descricao).toMatch(/Nova venda/);
    expect(eventos[1].descricao).toMatch(/Segundo serviço/);
    expect(eventos[1].descricao).toMatch(/total/);
  });

  it("apagar uma venda refaz o total e não mexe nas outras", async () => {
    await registrarVenda({ leadId: L, clienteId: C, valor: 2000 });
    const { venda } = await registrarVenda({ leadId: L, clienteId: C, valor: 1500 });

    const r = await apagarVenda(venda.id, AG);
    expect(r?.total).toBe(2000);
    expect(await vendasDoLead(L)).toHaveLength(1);

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: L } });
    expect(Number(lead.valorVenda)).toBe(2000);
  });

  it("venda de outra agência não é apagada", async () => {
    const { venda } = await registrarVenda({ leadId: L, clienteId: C, valor: 2000 });
    expect(await apagarVenda(venda.id, "agencia-de-outra-pessoa")).toBeNull();
    expect(await vendasDoLead(L)).toHaveLength(1);
  });
});
