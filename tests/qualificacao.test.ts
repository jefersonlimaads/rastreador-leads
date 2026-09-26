/**
 * Qualificação e motivo de perda: o que separa "traz pouca gente" de
 * "traz gente errada" — dois problemas que pedem ações opostas.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { leituraDaPerda, qualificacaoDoCliente } from "../src/lib/qualificacao";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const AG = "agencia-qualif-teste";
const C = "cliente-qualif-teste";
const DE = new Date(Date.now() - 30 * 864e5);
// Amanhã: os leads nascem depois desta linha rodar, e "agora" já teria passado.
const ATE = new Date(Date.now() + 864e5);

async function limpar() {
  await prisma.evento.deleteMany({ where: { clienteId: C } });
  await prisma.lead.deleteMany({ where: { clienteId: C } });
  await prisma.cliente.deleteMany({ where: { id: C } });
  await prisma.agencia.deleteMany({ where: { id: AG } });
}

let n = 0;
async function lead(status: string, motivo?: string, passouPorQualificado = false) {
  const l = await prisma.lead.create({
    data: {
      clienteId: C,
      telefone: `5519955${String(n++).padStart(6, "0")}`,
      mensagemEm: new Date(),
      status: status as never,
      motivoPerdaCategoria: motivo ?? null,
    },
  });
  if (passouPorQualificado) {
    await prisma.evento.create({
      data: { clienteId: C, leadId: l.id, tipo: "MUDANCA_STATUS", descricao: "Status: Qualificado" },
    });
  }
  return l;
}

beforeEach(async () => {
  await limpar();
  await prisma.agencia.create({ data: { id: AG, nome: "Qualif", slug: AG } });
  await prisma.cliente.create({ data: { id: C, agenciaId: AG, nome: "Cliente Qualif" } });
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("qualificação", () => {
  it("quem fechou conta como qualificado, mesmo sem passar pela etapa", async () => {
    await lead("FECHADO");
    await lead("PROPOSTA_ENVIADA");
    await lead("QUALIFICADO");
    await lead("EM_ATENDIMENTO");
    await lead("NOVO");

    const q = await qualificacaoDoCliente(C, DE, ATE);
    expect(q.contatos).toBe(5);
    expect(q.qualificados).toBe(3);
    expect(q.taxa).toBeCloseTo(0.6);
  });

  it("lead que foi qualificado e depois perdido continua contando", async () => {
    await lead("PERDIDO", "ESCOLHEU_CONCORRENTE", true);
    await lead("PERDIDO", "SEM_INTERESSE");

    const q = await qualificacaoDoCliente(C, DE, ATE);
    expect(q.qualificados).toBe(1);
    expect(q.perdidos).toBe(2);
  });
});

describe("leitura da perda", () => {
  it("aponta o anúncio quando o padrão é de segmentação", async () => {
    for (let i = 0; i < 4; i++) await lead("PERDIDO", "SEM_INTERESSE");
    for (let i = 0; i < 3; i++) await lead("PERDIDO", "FORA_DA_REGIAO");
    await lead("PERDIDO", "NAO_RESPONDEU");

    const leitura = leituraDaPerda(await qualificacaoDoCliente(C, DE, ATE));
    expect(leitura?.titulo).toMatch(/anúncio/i);
    expect(leitura?.acao).toMatch(/segmenta|público|região/i);
    expect(leitura?.motivo).toMatch(/7 de 8/);
  });

  it("aponta o atendimento quando o cliente não responde", async () => {
    for (let i = 0; i < 5; i++) await lead("PERDIDO", "NAO_RESPONDEU");
    await lead("PERDIDO", "ATENDIMENTO_DEMORADO");

    const leitura = leituraDaPerda(await qualificacaoDoCliente(C, DE, ATE));
    expect(leitura?.titulo).toMatch(/atendimento/i);
    expect(leitura?.acao).toMatch(/tempo de resposta/i);
  });

  it("poucas perdas não viram padrão", async () => {
    for (let i = 0; i < 3; i++) await lead("PERDIDO", "SEM_INTERESSE");
    expect(leituraDaPerda(await qualificacaoDoCliente(C, DE, ATE))).toBeNull();
  });

  it("perdas espalhadas não acusam ninguém", async () => {
    await lead("PERDIDO", "SEM_INTERESSE");
    await lead("PERDIDO", "FORA_DA_REGIAO");
    await lead("PERDIDO", "NAO_RESPONDEU");
    await lead("PERDIDO", "ATENDIMENTO_DEMORADO");
    await lead("PERDIDO", "ESCOLHEU_CONCORRENTE");
    await lead("PERDIDO", "OUTRO");

    // Nenhuma causa passa de metade: melhor não apontar do que apontar errado.
    expect(leituraDaPerda(await qualificacaoDoCliente(C, DE, ATE))).toBeNull();
  });
});
