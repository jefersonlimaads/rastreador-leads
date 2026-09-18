/**
 * Regras das propostas que protegem o negócio: aceite ativa o cliente, recusa
 * sem motivo não passa, e proposta aceita não se apaga.
 * Precisa do banco local no ar: npm run db:start
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  aceitarProposta,
  alternarNegociacao,
  escopoDoTexto,
  excluirProposta,
  gerarToken,
  marcarEnviada,
  recusarProposta,
  situacao,
} from "../src/lib/propostas";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CLIENTE = "prospect-teste-auto";

async function limpar() {
  await prisma.tarefa.deleteMany({ where: { clienteId: CLIENTE } });
  await prisma.proposta.deleteMany({ where: { clienteId: CLIENTE } });
  await prisma.cliente.deleteMany({ where: { id: CLIENTE } });
}

async function novaProposta() {
  const validade = new Date();
  validade.setUTCDate(validade.getUTCDate() + 7);
  const p = await prisma.proposta.create({
    data: {
      clienteId: CLIENTE,
      token: gerarToken(),
      titulo: "Teste",
      escopo: [{ titulo: "Gestão de campanhas" }],
      feeMensal: 1800,
      setup: 500,
      validade: new Date(validade.toISOString().slice(0, 10) + "T00:00:00Z"),
    },
  });
  await marcarEnviada(p.id);
  return prisma.proposta.findUniqueOrThrow({ where: { id: p.id } });
}

beforeEach(async () => {
  await limpar();
  await prisma.cliente.create({ data: { id: CLIENTE, nome: "Prospect teste", ciclo: "PROSPECCAO" } });
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("propostas", () => {
  it("escopo em texto vira lista de itens", () => {
    expect(escopoDoTexto("- Gestão: no Meta\nCriativos\n\n")).toEqual([
      { titulo: "Gestão", detalhe: "no Meta" },
      { titulo: "Criativos" },
    ]);
  });

  it("enviar leva o prospect para proposta enviada", async () => {
    await novaProposta();
    const c = await prisma.cliente.findUniqueOrThrow({ where: { id: CLIENTE } });
    expect(c.ciclo).toBe("PROPOSTA_ENVIADA");
  });

  it("aceite torna o cliente ativo com o fee e abre as tarefas", async () => {
    const p = await novaProposta();
    const r = await aceitarProposta(p.token, "Carolina Mendes");
    expect(r.ok).toBe(true);

    const c = await prisma.cliente.findUniqueOrThrow({
      where: { id: CLIENTE },
      include: { tarefas: true },
    });
    expect(c.ciclo).toBe("ATIVO");
    expect(Number(c.feeMensal)).toBe(1800);
    const abertas = c.tarefas.filter((t) => t.status === "ABERTA");
    expect(abertas.map((t) => t.titulo)).toEqual(
      expect.arrayContaining(["Onboarding: pedir acessos"]),
    );
    expect(abertas).toHaveLength(2); // onboarding + cobrar implantação

    // A tarefa automática de acompanhar a proposta se conclui com o aceite.
    const acompanhar = c.tarefas.find((t) => t.chave === "etapa:PROPOSTA_ENVIADA");
    expect(acompanhar?.status).toBe("FEITA");
  });

  it("recusa sem motivo não passa", async () => {
    const p = await novaProposta();
    const r = await recusarProposta(p.token, "   não   ");
    expect(r.erro).toBeTruthy();

    const depois = await prisma.proposta.findUniqueOrThrow({ where: { id: p.id } });
    expect(depois.status).toBe("ENVIADA");
  });

  it("recusa com motivo fica registrada", async () => {
    const p = await novaProposta();
    const r = await recusarProposta(p.token, "Achei o valor acima do que posso agora");
    expect(r.ok).toBe(true);

    const depois = await prisma.proposta.findUniqueOrThrow({ where: { id: p.id } });
    expect(depois.status).toBe("RECUSADA");
    expect(depois.motivoRecusa).toBe("Achei o valor acima do que posso agora");
  });

  it("negociação move o ciclo do prospect e não expira", async () => {
    const p = await novaProposta();
    await alternarNegociacao(p.id);

    const c = await prisma.cliente.findUniqueOrThrow({ where: { id: CLIENTE } });
    expect(c.ciclo).toBe("NEGOCIANDO");

    const vencida = { status: "NEGOCIANDO", validade: new Date("2020-01-01"), visualizadaEm: null };
    expect(situacao(vencida)).toBe("negociando");
  });

  it("proposta em negociação ainda aceita pelo link", async () => {
    const p = await novaProposta();
    await alternarNegociacao(p.id);
    const r = await aceitarProposta(p.token, "Carolina Mendes");
    expect(r.ok).toBe(true);
  });

  it("proposta aceita não pode ser excluída", async () => {
    const p = await novaProposta();
    await aceitarProposta(p.token, "Carolina Mendes");
    const r = await excluirProposta(p.id);
    expect(r.erro).toBeTruthy();
    expect(await prisma.proposta.findUnique({ where: { id: p.id } })).not.toBeNull();
  });

  it("proposta não aceita é excluída de vez", async () => {
    const p = await novaProposta();
    const r = await excluirProposta(p.id);
    expect(r.ok).toBe(true);
    expect(await prisma.proposta.findUnique({ where: { id: p.id } })).toBeNull();
  });
});

describe("etapa do prospect acompanha as propostas", () => {
  it("excluir a única proposta tira o prospect de proposta enviada", async () => {
    // Era o bug: a proposta sumia do pipeline e o prospect ficava em
    // "proposta enviada" sem proposta nenhuma.
    const p = await novaProposta();
    await excluirProposta(p.id);

    const c = await prisma.cliente.findUniqueOrThrow({ where: { id: CLIENTE } });
    expect(c.ciclo).not.toBe("PROPOSTA_ENVIADA");
    expect(c.ciclo).toBe("REUNIAO_MARCADA");
  });

  it("recusa da única proposta marca o prospect como perdido, com o motivo", async () => {
    const p = await novaProposta();
    await recusarProposta(p.token, "Fechei com outra agência na semana passada");

    const c = await prisma.cliente.findUniqueOrThrow({ where: { id: CLIENTE } });
    expect(c.ciclo).toBe("PERDIDO");
    expect(c.motivoPerda).toBe("Fechei com outra agência na semana passada");
  });

  it("com duas propostas, recusar uma não perde o prospect", async () => {
    await novaProposta();
    const segunda = await novaProposta();
    await recusarProposta(segunda.token, "Essa versão ficou cara, prefiro a outra");

    const c = await prisma.cliente.findUniqueOrThrow({ where: { id: CLIENTE } });
    expect(c.ciclo).toBe("PROPOSTA_ENVIADA");
  });

  it("sair da negociação volta para proposta enviada", async () => {
    const p = await novaProposta();
    await alternarNegociacao(p.id);
    await alternarNegociacao(p.id);

    const c = await prisma.cliente.findUniqueOrThrow({ where: { id: CLIENTE } });
    expect(c.ciclo).toBe("PROPOSTA_ENVIADA");
  });
});
