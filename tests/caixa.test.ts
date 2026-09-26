/**
 * Fluxo de caixa e a regra de uma verdade só para o custo do cliente:
 * despesa lançada manda; sem ela, vale a estimativa do cadastro.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { custoPorCliente, fluxoDeCaixa, gerarDespesasRecorrentes } from "../src/lib/financeiro";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const AG = "agencia-caixa";
const C1 = "cliente-caixa-1";
const C2 = "cliente-caixa-2";

const MES = new Date(Date.UTC(2026, 8, 1)); // setembro/2026
const MES_ANTERIOR = new Date(Date.UTC(2026, 7, 1));

async function limpar() {
  await prisma.despesa.deleteMany({ where: { agenciaId: AG } });
  await prisma.fatura.deleteMany({ where: { clienteId: { in: [C1, C2] } } });
  await prisma.cliente.deleteMany({ where: { id: { in: [C1, C2] } } });
  await prisma.agencia.deleteMany({ where: { id: AG } });
}

beforeEach(async () => {
  await limpar();
  await prisma.agencia.create({ data: { id: AG, nome: "Caixa", slug: AG } });
  // C1 tem estimativa no cadastro; C2 também, mas vai ter despesa lançada.
  await prisma.cliente.create({
    data: { id: C1, agenciaId: AG, nome: "Cliente 1", ciclo: "ATIVO", feeMensal: 2000, custoMensal: 300 },
  });
  await prisma.cliente.create({
    data: { id: C2, agenciaId: AG, nome: "Cliente 2", ciclo: "ATIVO", feeMensal: 3000, custoMensal: 500 },
  });
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("custo do cliente", () => {
  it("sem despesa lançada, vale a estimativa do cadastro", async () => {
    const custos = await custoPorCliente(AG, MES);
    expect(custos.get(C1)).toEqual({ valor: 300, origem: "estimado" });
  });

  it("com despesa lançada, ela manda — e a origem volta junto", async () => {
    await prisma.despesa.create({
      data: { agenciaId: AG, clienteId: C2, descricao: "Editor do mês", valor: 800, competencia: MES },
    });
    const custos = await custoPorCliente(AG, MES);
    expect(custos.get(C2)).toEqual({ valor: 800, origem: "lancado" });
    // O outro continua na estimativa: a regra é por cliente, não por agência.
    expect(custos.get(C1)?.origem).toBe("estimado");
  });

  it("despesa da agência, sem cliente, não entra no custo de ninguém", async () => {
    await prisma.despesa.create({
      data: { agenciaId: AG, descricao: "Assinatura da ferramenta", valor: 200, competencia: MES },
    });
    const custos = await custoPorCliente(AG, MES);
    expect(custos.get(C1)?.valor).toBe(300);
    expect(custos.get(C2)?.valor).toBe(500);
  });
});

describe("fluxo de caixa", () => {
  it("separa o que o mês promete do que já passou pela conta", async () => {
    await prisma.fatura.createMany({
      data: [
        { clienteId: C1, competencia: MES, valor: 2000, vencimento: new Date(Date.UTC(2026, 8, 10)), status: "PAGA" },
        { clienteId: C2, competencia: MES, valor: 3000, vencimento: new Date(Date.UTC(2026, 8, 10)), status: "ABERTA" },
      ],
    });
    await prisma.despesa.createMany({
      data: [
        { agenciaId: AG, descricao: "Ferramenta", valor: 200, competencia: MES, pagoEm: new Date(Date.UTC(2026, 8, 5)) },
        { agenciaId: AG, descricao: "Freelancer", valor: 800, competencia: MES },
      ],
    });

    const meses = await fluxoDeCaixa(AG, 24);
    const setembro = meses.find((m) => m.competencia.getTime() === MES.getTime())!;

    expect(setembro.receitaPrevista).toBe(5000);
    expect(setembro.receitaRecebida).toBe(2000);
    expect(setembro.despesaLancada).toBe(1000);
    expect(setembro.despesaPaga).toBe(200);
    expect(setembro.saldoPrevisto).toBe(4000); // 5000 − 1000
    expect(setembro.saldoRealizado).toBe(1800); // 2000 − 200
  });
});

describe("despesa recorrente", () => {
  it("nasce no mês novo uma vez só, mesmo rodando todos os dias", async () => {
    await prisma.despesa.create({
      data: {
        agenciaId: AG, descricao: "Assinatura", valor: 150, competencia: MES_ANTERIOR,
        vencimento: new Date(Date.UTC(2026, 7, 20)), recorrente: true,
      },
    });

    expect(await gerarDespesasRecorrentes(MES)).toBe(1);
    expect(await gerarDespesasRecorrentes(MES)).toBe(0);

    const nova = await prisma.despesa.findFirstOrThrow({ where: { agenciaId: AG, competencia: MES } });
    expect(Number(nova.valor)).toBe(150);
    expect(nova.pagoEm).toBeNull(); // nasce em aberto
    expect(nova.vencimento?.getUTCDate()).toBe(20); // o dia combinado, no mês novo
  });

  it("despesa avulsa não se repete", async () => {
    await prisma.despesa.create({
      data: { agenciaId: AG, descricao: "Compra única", valor: 90, competencia: MES_ANTERIOR },
    });
    expect(await gerarDespesasRecorrentes(MES)).toBe(0);
  });
});

describe("tarefa que se repete", () => {
  it("conta a partir do prazo, para a série não escorregar com o atraso", async () => {
    const { proximaOcorrencia } = await import("../src/lib/regras");
    const prazo = new Date(Date.UTC(2026, 8, 1)); // terça, 1º de setembro
    const feitaEm = new Date(Date.UTC(2026, 8, 4)); // entregue com três dias de atraso

    // A próxima continua na terça seguinte, não três dias depois da entrega.
    expect(proximaOcorrencia(prazo, "semanal", feitaEm)?.toISOString().slice(0, 10)).toBe("2026-09-08");
    expect(proximaOcorrencia(prazo, "quinzenal", feitaEm)?.toISOString().slice(0, 10)).toBe("2026-09-16");
    expect(proximaOcorrencia(prazo, "mensal", feitaEm)?.toISOString().slice(0, 10)).toBe("2026-10-01");
  });

  it("tarefa muito atrasada não nasce já vencida", async () => {
    const { proximaOcorrencia } = await import("../src/lib/regras");
    const prazoVelho = new Date(Date.UTC(2026, 5, 1)); // três meses atrás
    const hoje = new Date(Date.UTC(2026, 8, 10));

    const proximo = proximaOcorrencia(prazoVelho, "semanal", hoje)!;
    expect(proximo.getTime()).toBeGreaterThan(hoje.getTime() - 864e5);
    // E mantém o dia da semana da série original.
    expect(proximo.getUTCDay()).toBe(prazoVelho.getUTCDay());
  });

  it("sem recorrência, não há próxima", async () => {
    const { proximaOcorrencia } = await import("../src/lib/regras");
    expect(proximaOcorrencia(new Date(), null)).toBeNull();
    expect(proximaOcorrencia(new Date(), "")).toBeNull();
  });
});
