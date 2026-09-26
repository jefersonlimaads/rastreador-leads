/**
 * A rota de leads externos, de ponta a ponta: chave, isolamento por agência e
 * os três níveis de origem.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { POST, GET } from "../src/app/api/leads/route";
import { gerarChaveImportacao } from "../src/lib/pesquisa/importacao";
import type { NextRequest } from "next/server";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const AG = "agencia-api-leads";
const OUTRA = "agencia-api-outra";
const C = "cliente-api-leads";
const C_OUTRA = "cliente-api-outra";
let chave = "";

function pedido(corpo: unknown, autorizacao = `Bearer ${chave}`): NextRequest {
  return {
    headers: new Headers({ authorization: autorizacao }),
    json: async () => corpo,
  } as unknown as NextRequest;
}

async function limpar() {
  for (const id of [C, C_OUTRA]) {
    await prisma.envioCapi.deleteMany({ where: { clienteId: id } });
    await prisma.evento.deleteMany({ where: { clienteId: id } });
    await prisma.lead.deleteMany({ where: { clienteId: id } });
    await prisma.clique.deleteMany({ where: { clienteId: id } });
    await prisma.cliente.deleteMany({ where: { id } });
  }
  await prisma.agencia.deleteMany({ where: { id: { in: [AG, OUTRA] } } });
}

beforeEach(async () => {
  await limpar();
  await prisma.agencia.create({ data: { id: AG, nome: "API Leads", slug: AG } });
  await prisma.agencia.create({ data: { id: OUTRA, nome: "Outra", slug: OUTRA } });
  await prisma.cliente.create({ data: { id: C, agenciaId: AG, nome: "Cliente API" } });
  await prisma.cliente.create({ data: { id: C_OUTRA, agenciaId: OUTRA, nome: "Cliente de outra" } });
  chave = await gerarChaveImportacao(AG);
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("rota de leads", () => {
  it("chave errada não entra", async () => {
    const r = await GET(pedido(null, "Bearer jli_naoexiste_xxxxxxxxxxxxxxxx"));
    expect(r.status).toBe(401);
  });

  it("cliente de outra agência é recusado, mesmo com chave válida", async () => {
    const r = await POST(pedido({ leads: [{ clienteId: C_OUTRA, telefone: "11988887777" }] }));
    const j = await r.json();
    expect(j.criados).toBe(0);
    expect(j.recusados[0].erro).toMatch(/não é desta agência/);
    expect(await prisma.lead.count({ where: { clienteId: C_OUTRA } })).toBe(0);
  });

  it("sem origem, o lead entra como não identificado", async () => {
    const r = await POST(pedido({ leads: [{ clienteId: C, telefone: "11988887777", nome: "Ana" }] }));
    const j = await r.json();
    expect(j.criados).toBe(1);
    expect(j.origem).toMatchObject({ nao_identificada: 1 });

    const lead = await prisma.lead.findFirstOrThrow({ where: { clienteId: C } });
    expect(lead.atribuicao).toBe("DESCONHECIDA");
    expect(lead.cliqueId).toBeNull();
    expect(lead.origem).toBe("WEBHOOK");
  });

  it("origem que veio no envio vira informada, não confirmada", async () => {
    const r = await POST(
      pedido({ leads: [{ clienteId: C, telefone: "11977776666", adId: "120250", utmCampaign: "[LEADS] SP" }] }),
    );
    const j = await r.json();
    expect(j.origem).toMatchObject({ informada: 1 });

    const lead = await prisma.lead.findFirstOrThrow({ where: { clienteId: C }, include: { clique: true } });
    // Guarda a origem para agrupar por campanha, sem afirmar que ela gerou a venda.
    expect(lead.atribuicao).toBe("PROVAVEL");
    expect(lead.clique?.adId).toBe("120250");
  });

  it("clique nosso que bate pelo código vira origem confirmada", async () => {
    await prisma.clique.create({
      data: { clienteId: C, codigo: "K7RPW", adId: "120250", fbclid: "fb.1.abc" },
    });
    const r = await POST(pedido({ leads: [{ clienteId: C, telefone: "11966665555", codigo: "K7RPW" }] }));
    const j = await r.json();
    expect(j.origem).toMatchObject({ confirmada: 1 });

    const lead = await prisma.lead.findFirstOrThrow({ where: { clienteId: C }, include: { clique: true } });
    expect(lead.atribuicao).toBe("EXATA");
    expect(lead.clique?.codigo).toBe("K7RPW");
  });

  it("o fbclid também confirma, porque é único por clique", async () => {
    await prisma.clique.create({ data: { clienteId: C, codigo: "ZZ9QQ", fbclid: "fb.1.unico.123" } });
    const r = await POST(pedido({ leads: [{ clienteId: C, telefone: "11955554444", fbclid: "fb.1.unico.123" }] }));
    expect((await r.json()).origem).toMatchObject({ confirmada: 1 });
  });

  it("o mesmo telefone chegando de novo vira retorno, não lead novo", async () => {
    await POST(pedido({ leads: [{ clienteId: C, telefone: "11944443333" }] }));
    const r = await POST(pedido({ leads: [{ clienteId: C, telefone: "11944443333" }] }));
    const j = await r.json();
    expect(j.criados).toBe(0);
    expect(j.retornos).toBe(1);
    expect(await prisma.lead.count({ where: { clienteId: C } })).toBe(1);
  });
});
