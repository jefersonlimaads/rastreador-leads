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
      gaps: [
        "Site sem Pixel do Meta: não sabe quem visita, nem consegue fazer remarketing.",
        "Sem telefone público: abordagem só por Instagram ou e-mail.",
      ],
      resumo: "Presença digital só orgânica.",
    },
  });
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("abertura sugerida", () => {
  it("resume a conversa, aponta a oportunidade e diz como o trabalho anda", async () => {
    const a = await aberturaSugerida(C);
    expect(a.texto).toContain("Carolina");
    expect(a.texto).toContain("15 de setembro");

    // 1. O que foi levantado, na linguagem da própria pessoa.
    expect(a.texto).toContain("• A agenda enche de retorno");
    expect(a.texto).toContain("• Já tentou impulsionar post duas vezes");

    // 2. O gap vem acompanhado do que muda quando se resolve.
    expect(a.texto).toContain("Onde está a oportunidade:");
    expect(a.texto).toContain("Site sem Pixel do Meta");
    expect(a.texto).toMatch(/custo por contato cai/);
    // Não afirma que olhamos a concorrência: o diagnóstico não faz isso.
    expect(a.texto).not.toMatch(/concorrência/i);

    // 3. Como o trabalho acontece, que é fato sobre nós.
    expect(a.texto).toContain("Como o trabalho acontece:");
    expect(a.texto).toMatch(/entendemos o cenário atual/);
    expect(a.texto).toMatch(/Reunião quinzenal/);

    // O material cru fica disponível para completar à mão.
    expect(a.historico).toHaveLength(2);
    expect(a.historico[0].tipo).toBe("Reunião");
    expect(a.pontos.length).toBeGreaterThanOrEqual(2);
  });

  it("gap sem ganho conhecido entra sozinho, sem frase inventada", async () => {
    const a = await aberturaSugerida(C);
    // "Sem telefone público" não tem ganho mapeado: o texto não ganha enfeite.
    expect(a.texto).not.toMatch(/undefined/);
  });

  it("sem histórico, não inventa conversa que não houve", async () => {
    const a = await aberturaSugerida(VAZIO);
    expect(a.historico).toHaveLength(0);
    expect(a.pontos).toHaveLength(0);
    expect(a.texto).not.toMatch(/dia \d/);
    expect(a.texto).not.toMatch(/Onde está a oportunidade/);
    expect(a.texto).toContain("escreva aqui os pontos da reunião");
    // O método continua valendo mesmo sem histórico nenhum.
    expect(a.texto).toContain("Como o trabalho acontece:");
  });

  it("cliente que não existe não quebra a tela", async () => {
    expect(await aberturaSugerida("nao-existe")).toEqual({ texto: "", historico: [], pontos: [] });
  });
});
