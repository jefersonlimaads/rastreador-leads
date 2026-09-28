/**
 * As réguas do diagnóstico: cliente ganha de nicho, que ganha de agência, que
 * ganha do padrão. Régua errada é pior que régua nenhuma — manda trocar o
 * criativo que estava funcionando.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { definirRegua, reguasDoCliente } from "../src/lib/parametros";
import { PADRAO_DAS_REGUAS } from "../src/lib/reguas";
import { funilDoAnuncio } from "../src/lib/funil-anuncio";
import type { AnuncioPeriodo } from "../src/lib/inteligencia";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const AG = "agencia-reguas";
const C = "cliente-reguas";
const C2 = "cliente-reguas-2";

async function limpar() {
  await prisma.parametroDiagnostico.deleteMany({ where: { agenciaId: AG } });
  await prisma.cliente.deleteMany({ where: { id: { in: [C, C2] } } });
  await prisma.agencia.deleteMany({ where: { id: AG } });
}

beforeEach(async () => {
  await limpar();
  await prisma.agencia.create({ data: { id: AG, nome: "Réguas", slug: AG } });
  await prisma.cliente.create({ data: { id: C, agenciaId: AG, nome: "Consultoria", nicho: "consultoria" } });
  await prisma.cliente.create({ data: { id: C2, agenciaId: AG, nome: "Outro", nicho: "consultoria" } });
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("resolução das réguas", () => {
  it("sem nada configurado, vale o padrão do código", async () => {
    const r = await reguasDoCliente(C);
    expect(r.pagina).toMatchObject({ ...PADRAO_DAS_REGUAS.pagina, origem: "padrao" });
  });

  it("régua da agência vale para todos os clientes dela", async () => {
    await definirRegua({ agenciaId: AG, chave: "pagina", ruim: 0.05, bom: 0.2 });
    expect(await reguasDoCliente(C)).toMatchObject({
      pagina: { ruim: 0.05, bom: 0.2, origem: "agencia" },
    });
    expect((await reguasDoCliente(C2)).pagina.origem).toBe("agencia");
  });

  it("régua do nicho ganha da agência", async () => {
    await definirRegua({ agenciaId: AG, chave: "pagina", ruim: 0.05, bom: 0.2 });
    await definirRegua({ agenciaId: AG, nicho: "consultoria", chave: "pagina", ruim: 0.01, bom: 0.04 });

    const r = await reguasDoCliente(C);
    expect(r.pagina).toMatchObject({ ruim: 0.01, bom: 0.04, origem: "nicho" });
  });

  it("régua do cliente ganha de todas", async () => {
    await definirRegua({ agenciaId: AG, chave: "pagina", ruim: 0.05, bom: 0.2 });
    await definirRegua({ agenciaId: AG, nicho: "consultoria", chave: "pagina", ruim: 0.01, bom: 0.04 });
    await definirRegua({ agenciaId: AG, clienteId: C, chave: "pagina", ruim: 0.02, bom: 0.06 });

    expect((await reguasDoCliente(C)).pagina).toMatchObject({ ruim: 0.02, origem: "cliente" });
    // O outro cliente do mesmo nicho não é afetado.
    expect((await reguasDoCliente(C2)).pagina.origem).toBe("nicho");
  });

  it("herda por chave: mexer numa não zera as outras", async () => {
    await definirRegua({ agenciaId: AG, clienteId: C, chave: "pagina", ruim: 0.02, bom: 0.06 });
    const r = await reguasDoCliente(C);
    expect(r.pagina.origem).toBe("cliente");
    expect(r.ctr.origem).toBe("padrao");
    expect(r.fechamento.origem).toBe("padrao");
  });

  it("voltar ao padrão apaga a linha, para a herança valer de novo", async () => {
    await definirRegua({ agenciaId: AG, chave: "pagina", ruim: 0.05, bom: 0.2 });
    await definirRegua({ agenciaId: AG, clienteId: C, chave: "pagina", ...PADRAO_DAS_REGUAS.pagina });

    // Sem linha do cliente, volta a herdar a da agência.
    expect((await reguasDoCliente(C)).pagina.origem).toBe("agencia");
  });

  it("ruim maior que bom é recusado", async () => {
    const r = await definirRegua({ agenciaId: AG, chave: "pagina", ruim: 0.3, bom: 0.1 });
    expect(r).toHaveProperty("erro");
  });
});

describe("a régua muda o diagnóstico", () => {
  const anuncio: AnuncioPeriodo = {
    adId: "a", nome: "Anúncio", campanha: null, tipo: "leads_site",
    gasto: 500, impressoes: 50000, cliquesLink: 1000, cliquesSaida: 1000,
    resultados: 40, visualizacoesPagina: 800, conversasIniciadas: 0,
    pedidosContato: 40, contatosPainel: 40, fechados: 10, receita: 50000,
  };

  it("5% de conversão é ruim para e-commerce e bom para consultoria", async () => {
    // 40 pedidos em 800 visitas = 5%.
    const comPadrao = funilDoAnuncio(anuncio, true);
    expect(comPadrao.etapas.find((e) => e.chave === "pedidos")?.estado).toBe("ok");

    const exigente = funilDoAnuncio(anuncio, true, {
      ...PADRAO_DAS_REGUAS,
      pagina: { ruim: 0.08, bom: 0.15 },
    });
    expect(exigente.gargalo?.chave).toBe("pedidos");

    const tolerante = funilDoAnuncio(anuncio, true, {
      ...PADRAO_DAS_REGUAS,
      pagina: { ruim: 0.01, bom: 0.04 },
    });
    expect(tolerante.etapas.find((e) => e.chave === "pedidos")?.estado).toBe("bom");
    expect(tolerante.gargalo).toBeNull();
  });
});
