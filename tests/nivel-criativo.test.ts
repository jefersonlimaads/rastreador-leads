/**
 * Nível de criativo: a mesma peça roda em anúncios e campanhas diferentes, e
 * é ela que se compara — não o anúncio que a embrulha.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { metricasPorAnuncio } from "../src/lib/metricas";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const AG = "agencia-criativo-teste";
const C = "cliente-criativo-teste";
const DIA = new Date("2026-09-10T00:00:00Z");
const DE = new Date("2026-09-01T00:00:00Z");
const ATE = new Date("2026-09-30T23:59:59Z");

async function limpar() {
  await prisma.lead.deleteMany({ where: { clienteId: C } });
  await prisma.clique.deleteMany({ where: { clienteId: C } });
  await prisma.gasto.deleteMany({ where: { clienteId: C } });
  await prisma.cliente.deleteMany({ where: { id: C } });
  await prisma.agencia.deleteMany({ where: { id: AG } });
}

beforeAll(async () => {
  await limpar();
  await prisma.agencia.create({ data: { id: AG, nome: "Criativo", slug: AG } });
  await prisma.cliente.create({ data: { id: C, agenciaId: AG, nome: "Cliente Criativo" } });

  // A MESMA peça (cr-1) em dois anúncios, de campanhas diferentes.
  await prisma.gasto.createMany({
    data: [
      { clienteId: C, adId: "ad-1", campaignId: "camp-1", adNome: "Reels depoimento | frio",
        campaignNome: "Frio", creativeId: "cr-1", dia: DIA, valor: 300, impressoes: 10000, cliques: 100 },
      { clienteId: C, adId: "ad-2", campaignId: "camp-2", adNome: "Reels depoimento | remarketing",
        campaignNome: "Remarketing", creativeId: "cr-1", dia: DIA, valor: 100, impressoes: 3000, cliques: 40 },
      // Uma peça diferente, num anúncio só.
      { clienteId: C, adId: "ad-3", campaignId: "camp-1", adNome: "Carrossel antes e depois",
        campaignNome: "Frio", creativeId: "cr-2", dia: DIA, valor: 200, impressoes: 8000, cliques: 60 },
      // Linha antiga, sem criativo informado.
      { clienteId: C, adId: "ad-4", campaignId: "camp-1", adNome: "Anúncio velho",
        campaignNome: "Frio", creativeId: null, dia: DIA, valor: 50, impressoes: 1000, cliques: 5 },
    ],
  });

  // Um lead por anúncio da peça cr-1, e um da cr-2.
  for (const [i, ad] of ["ad-1", "ad-2", "ad-3"].entries()) {
    const clique = await prisma.clique.create({
      data: { clienteId: C, codigo: `CR${i}`, adId: ad, campaignId: "camp-1", criadoEm: DIA },
    });
    await prisma.lead.create({
      data: {
        clienteId: C, telefone: `55199770000${i}`, mensagemEm: DIA, criadoEm: DIA,
        cliqueId: clique.id, atribuicao: "EXATA",
      },
    });
  }
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("nível de criativo", () => {
  it("junta a mesma peça que roda em anúncios diferentes", async () => {
    const r = await metricasPorAnuncio({ clienteId: C, de: DE, ate: ATE, nivel: "creative" });
    const cr1 = r.linhas.find((l) => l.chave === "cr-1");

    expect(cr1?.gasto).toBe(400); // 300 + 100, das duas campanhas
    expect(cr1?.leads).toBe(2); // um lead de cada anúncio
    // O nome é o do anúncio que mais gastou, com a contagem ao lado.
    expect(cr1?.rotulo).toBe("Reels depoimento | frio · em 2 anúncios");
  });

  it("peça em um anúncio só aparece com o nome limpo", async () => {
    const r = await metricasPorAnuncio({ clienteId: C, de: DE, ate: ATE, nivel: "creative" });
    expect(r.linhas.find((l) => l.chave === "cr-2")?.rotulo).toBe("Carrossel antes e depois");
  });

  it("gasto sem criativo entra no total e é avisado à parte", async () => {
    const r = await metricasPorAnuncio({ clienteId: C, de: DE, ate: ATE, nivel: "creative" });
    // O investimento do cliente não encolhe ao trocar de nível.
    expect(r.total.gasto).toBe(650);
    expect(r.gastoSemCriativo).toBe(50);
    expect(r.linhas.some((l) => l.chave === "ad-4")).toBe(false);
  });

  it("no nível de anúncio a mesma peça continua separada", async () => {
    const r = await metricasPorAnuncio({ clienteId: C, de: DE, ate: ATE, nivel: "ad" });
    expect(r.linhas.find((l) => l.chave === "ad-1")?.gasto).toBe(300);
    expect(r.linhas.find((l) => l.chave === "ad-2")?.gasto).toBe(100);
    expect(r.gastoSemCriativo).toBe(0);
  });
});
