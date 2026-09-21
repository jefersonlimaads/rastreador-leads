/**
 * Rascunho da abertura da proposta: sai do que está registrado, nada inventado.
 * Usa o banco local com um prospect próprio, limpo no fim.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { aberturaSugerida } from "../src/lib/abertura";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const AG = "agencia-abertura-teste";
const C = "prospect-abertura-teste";
const VAZIO = "prospect-abertura-vazio";

async function limpar() {
  await prisma.interacao.deleteMany({ where: { clienteId: { in: [C, VAZIO] } } });
  await prisma.diagnostico.deleteMany({ where: { agenciaId: AG } });
  await prisma.cliente.deleteMany({ where: { id: { in: [C, VAZIO] } } });
  await prisma.agencia.deleteMany({ where: { id: AG } });
}

beforeAll(async () => {
  await limpar();
  await prisma.agencia.create({ data: { id: AG, nome: "Abertura Teste", slug: AG } });
  await prisma.cliente.create({
    data: {
      id: C,
      agenciaId: AG,
      nome: "Clínica Exemplo",
      ciclo: "REUNIAO_MARCADA",
      contatoNome: "Carolina",
      nicho: "clínica odontológica",
      reuniaoEm: new Date("2026-09-15T14:00:00Z"),
    },
  });
  await prisma.cliente.create({
    data: { id: VAZIO, agenciaId: AG, nome: "Sem histórico", ciclo: "PROSPECCAO" },
  });

  await prisma.interacao.create({
    data: {
      clienteId: C,
      tipo: "REUNIAO",
      descricao: "A agenda enche de retorno, mas paciente novo quase não entra.",
      criadoEm: new Date("2026-09-15T15:00:00Z"),
    },
  });
  await prisma.interacao.create({
    data: {
      clienteId: C,
      tipo: "MENSAGEM",
      descricao: "Já tentou impulsionar post duas vezes e não veio nada.",
      criadoEm: new Date("2026-09-10T12:00:00Z"),
    },
  });

  await prisma.diagnostico.create({
    data: {
      agenciaId: AG,
      clienteId: C,
      placeId: "teste-abertura",
      nome: "Clínica Exemplo",
      gaps: ["O site não tem pixel instalado", "Nenhum anúncio ativo na biblioteca"],
      resumo: "Presença digital só orgânica.",
    },
  });
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("abertura sugerida", () => {
  it("cita a data da conversa, o que foi dito e o que o diagnóstico apontou", async () => {
    const a = await aberturaSugerida(C);
    expect(a.texto).toContain("Carolina");
    expect(a.texto).toContain("15 de setembro");
    // O que a pessoa disse, na linguagem dela.
    expect(a.texto).toContain("agenda enche de retorno");
    expect(a.texto).toContain("impulsionar post duas vezes");
    // O que o diagnóstico achou — sem afirmar que olhamos a concorrência.
    expect(a.texto).toContain("pixel instalado");
    expect(a.texto).not.toMatch(/concorrência/i);
    expect(a.texto).toMatch(/caminho que eu proponho/);

    // O material cru fica disponível para completar à mão.
    expect(a.historico).toHaveLength(2);
    expect(a.historico[0].tipo).toBe("Reunião");
    expect(a.pontos.length).toBeGreaterThanOrEqual(2);
  });

  it("sem histórico, não inventa conversa que não houve", async () => {
    const a = await aberturaSugerida(VAZIO);
    expect(a.historico).toHaveLength(0);
    expect(a.pontos).toHaveLength(0);
    expect(a.texto).not.toMatch(/dia \d/);
    expect(a.texto).toContain("pelo que conversamos");
  });

  it("cliente que não existe não quebra a tela", async () => {
    expect(await aberturaSugerida("nao-existe")).toEqual({ texto: "", historico: [], pontos: [] });
  });
});
