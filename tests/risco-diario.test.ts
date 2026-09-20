/**
 * Risco de cancelamento, diário de otimização e renovação de contrato.
 * Banco local, cliente próprio, limpo no fim.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { riscoDoCliente } from "../src/lib/risco";
import { diarioDoCliente } from "../src/lib/diario";
import { abrirTarefasDeRenovacao } from "../src/lib/financeiro";
import { hojeComoDataPura } from "../src/lib/datas";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const AG = "agencia-risco-teste";
const C = "cliente-risco-teste";
const DIA = 24 * 60 * 60 * 1000;

async function limpar() {
  await prisma.tarefa.deleteMany({ where: { agenciaId: AG } });
  await prisma.entrega.deleteMany({ where: { clienteId: C } });
  await prisma.relatorio.deleteMany({ where: { clienteId: C } });
  await prisma.fatura.deleteMany({ where: { clienteId: C } });
  await prisma.evento.deleteMany({ where: { clienteId: C } });
  await prisma.lead.deleteMany({ where: { clienteId: C } });
  await prisma.gasto.deleteMany({ where: { clienteId: C } });
  await prisma.cliente.deleteMany({ where: { id: C } });
  await prisma.agencia.deleteMany({ where: { id: AG } });
}

beforeAll(async () => {
  await limpar();
  await prisma.agencia.create({ data: { id: AG, nome: "Risco Teste", slug: AG } });
  await prisma.cliente.create({
    data: { id: C, agenciaId: AG, nome: "Cliente Risco", ciclo: "ATIVO", feeMensal: 2000 },
  });
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("risco de cancelamento", () => {
  it("junta queda de contatos, fatura atrasada e silêncio", async () => {
    const agora = Date.now();
    // 10 contatos entre 60 e 30 dias atrás, 2 nos últimos 30: queda de 80%.
    const criarLeads = (quantos: number, diasAtras: number, prefixo: string) =>
      prisma.lead.createMany({
        data: Array.from({ length: quantos }, (_, i) => ({
          clienteId: C,
          telefone: `55199${prefixo}${String(i).padStart(4, "0")}`,
          criadoEm: new Date(agora - diasAtras * DIA),
          mensagemEm: new Date(agora - diasAtras * DIA),
        })),
      });
    await criarLeads(10, 45, "11");
    await criarLeads(2, 10, "22");

    await prisma.fatura.create({
      data: {
        clienteId: C,
        competencia: new Date(Date.UTC(2026, 7, 1)),
        valor: 2000,
        vencimento: new Date(Date.UTC(2026, 7, 10)),
        status: "ABERTA",
      },
    });

    const r = await riscoDoCliente(C);
    const chaves = r!.sinais.map((s) => s.chave);
    expect(chaves).toContain("queda");
    expect(chaves).toContain("fatura");
    expect(chaves).toContain("sem_relatorio");
    expect(r!.nivel).toBe("alto");
  });
});

describe("diário de otimização", () => {
  it("compara os 7 dias antes com os 7 depois, e espera a janela fechar", async () => {
    const agora = Date.now();
    const marco = new Date(agora - 10 * DIA);

    // R$ 100 por dia nos 7 dias antes e nos 7 depois, e 8 contatos depois.
    const puro = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const base = puro(marco).getTime();
    await prisma.gasto.createMany({
      data: Array.from({ length: 14 }, (_, i) => ({
        clienteId: C,
        adId: `diario-${i}`,
        dia: new Date(base + (i - 7) * DIA),
        valor: 100,
      })),
    });
    await prisma.lead.createMany({
      data: Array.from({ length: 8 }, (_, i) => ({
        clienteId: C,
        telefone: `551933${String(i).padStart(4, "0")}`,
        criadoEm: new Date(marco.getTime() + (i % 7) * DIA + 3600_000),
        mensagemEm: new Date(marco.getTime() + (i % 7) * DIA + 3600_000),
      })),
    });

    await prisma.entrega.create({
      data: {
        clienteId: C,
        competencia: new Date(Date.UTC(marco.getUTCFullYear(), marco.getUTCMonth(), 1)),
        tipo: "Otimização",
        descricao: "Troquei o público e subi dois criativos",
        criadoEm: marco,
      },
    });
    // Entrega de ontem: janela ainda aberta.
    await prisma.entrega.create({
      data: {
        clienteId: C,
        competencia: new Date(Date.UTC(2026, 8, 1)),
        tipo: "Criativo",
        descricao: "Reels novo",
        criadoEm: new Date(agora - DIA),
      },
    });

    const d = await diarioDoCliente(C);
    expect(d).toHaveLength(2);
    expect(d[0].efeito).toBeNull(); // a de ontem
    const fechada = d[1];
    expect(fechada.efeito).not.toBeNull();
    expect(fechada.efeito!.gastoDepois).toBe(700);
    expect(fechada.efeito!.contatosDepois).toBeGreaterThan(0);
    expect(fechada.efeito!.resumo).toMatch(/contato/i);
  });
});

describe("renovação de contrato", () => {
  it("abre a tarefa 30 dias antes e não duplica", async () => {
    const hoje = hojeComoDataPura();
    await prisma.cliente.update({
      where: { id: C },
      data: { fimContrato: new Date(hoje.getTime() + 20 * DIA) },
    });

    expect(await abrirTarefasDeRenovacao()).toBeGreaterThanOrEqual(1);
    expect(await abrirTarefasDeRenovacao()).toBe(0);

    const tarefa = await prisma.tarefa.findFirst({ where: { clienteId: C, automatica: true } });
    expect(tarefa?.titulo).toMatch(/Renovação/);
  });
});
