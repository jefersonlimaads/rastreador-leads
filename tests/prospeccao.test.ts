/**
 * Prospecção: registrar contato anda a etapa, perdido exige motivo, e prospect
 * com histórico não se apaga.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  excluirProspect,
  marcarPerdido,
  reativarProspect,
  registrarInteracao,
} from "../src/lib/prospeccao";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ID = "prospect-funil-teste";

async function limpar() {
  await prisma.interacao.deleteMany({ where: { clienteId: ID } });
  await prisma.clique.deleteMany({ where: { clienteId: ID } });
  await prisma.cliente.deleteMany({ where: { id: ID } });
}

beforeEach(async () => {
  await limpar();
  await prisma.cliente.create({ data: { id: ID, nome: "Prospect do funil", ciclo: "PROSPECCAO" } });
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("prospecção", () => {
  it("registrar contato grava o histórico, anda a etapa e marca o retorno", async () => {
    const retorno = new Date("2026-10-01T00:00:00Z");
    await registrarInteracao({
      clienteId: ID,
      tipo: "MENSAGEM",
      descricao: "Primeira mensagem sobre o Reels dele",
      novaEtapa: "ABORDADO",
      proximoContato: retorno,
    });

    const c = await prisma.cliente.findUniqueOrThrow({
      where: { id: ID },
      include: { interacoes: true },
    });
    expect(c.ciclo).toBe("ABORDADO");
    expect(c.proximoContato?.toISOString()).toBe(retorno.toISOString());
    expect(c.interacoes).toHaveLength(1);
  });

  it("contato não mexe em etapa que pertence à proposta", async () => {
    await prisma.cliente.update({ where: { id: ID }, data: { ciclo: "NEGOCIANDO" } });
    await registrarInteracao({
      clienteId: ID,
      tipo: "LIGACAO",
      descricao: "Liguei para falar do valor",
      novaEtapa: "ABORDADO",
    });

    const c = await prisma.cliente.findUniqueOrThrow({ where: { id: ID } });
    expect(c.ciclo).toBe("NEGOCIANDO");
  });

  it("perdido sem motivo não passa", async () => {
    const r = await marcarPerdido(ID, "não");
    expect(r.erro).toBeTruthy();
  });

  it("perdido com motivo pode voltar para a prospecção", async () => {
    await marcarPerdido(ID, "Sem verba até o ano que vem");
    let c = await prisma.cliente.findUniqueOrThrow({ where: { id: ID } });
    expect(c.ciclo).toBe("PERDIDO");

    await reativarProspect(ID);
    c = await prisma.cliente.findUniqueOrThrow({ where: { id: ID } });
    expect(c.ciclo).toBe("PROSPECCAO");
    expect(c.motivoPerda).toBeNull();
  });

  it("prospect limpo é excluído junto com o histórico de contatos", async () => {
    await registrarInteracao({ clienteId: ID, tipo: "NOTA", descricao: "Contato de teste" });
    const r = await excluirProspect(ID);
    expect(r.ok).toBe(true);
    expect(await prisma.interacao.count({ where: { clienteId: ID } })).toBe(0);
  });

  it("prospect com clique registrado não pode ser excluído", async () => {
    await prisma.clique.create({ data: { clienteId: ID, codigo: "TSTPR" } });
    const r = await excluirProspect(ID);
    expect(r.erro).toBeTruthy();
    expect(await prisma.cliente.findUnique({ where: { id: ID } })).not.toBeNull();
  });
});
