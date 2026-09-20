/**
 * Meta do mês, saúde da implantação e tempo de resposta.
 * Usa o banco local com um cliente próprio, limpo no fim.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ritmoDoMes } from "../src/lib/metas";
import { saudeDoCliente } from "../src/lib/saude-cliente";
import { formatarEspera, tempoDeResposta } from "../src/lib/atendimento";
import { hojeComoDataPura } from "../src/lib/datas";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const AG = "agencia-metas-teste";
const C = "cliente-metas-teste";
const MIN = 60 * 1000;

async function limpar() {
  await prisma.evento.deleteMany({ where: { clienteId: C } });
  await prisma.lead.deleteMany({ where: { clienteId: C } });
  await prisma.clique.deleteMany({ where: { clienteId: C } });
  await prisma.gasto.deleteMany({ where: { clienteId: C } });
  await prisma.contaAnuncios.deleteMany({ where: { clienteId: C } });
  await prisma.numeroWhatsapp.deleteMany({ where: { clienteId: C } });
  await prisma.cliente.deleteMany({ where: { id: C } });
  await prisma.agencia.deleteMany({ where: { id: AG } });
}

beforeAll(async () => {
  await limpar();
  await prisma.agencia.create({ data: { id: AG, nome: "Metas Teste", slug: AG } });
  await prisma.cliente.create({
    data: { id: C, agenciaId: AG, nome: "Cliente Metas", orcamentoMensal: 3000, metaContatos: 60, metaCpl: 50 },
  });
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("meta do mês", () => {
  it("projeta o fechamento pelo ritmo de gasto por dia corrido", async () => {
    // Gasto de R$ 200 por dia desde o dia 1 até hoje.
    const hoje = hojeComoDataPura();
    const primeiro = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
    const dias = hoje.getUTCDate();
    await prisma.gasto.createMany({
      data: Array.from({ length: dias }, (_, i) => ({
        clienteId: C,
        adId: `meta-ad-${i}`,
        dia: new Date(primeiro.getTime() + i * 24 * 60 * 60 * 1000),
        valor: 200,
      })),
    });

    const r = await ritmoDoMes(C);
    expect(r).not.toBeNull();
    expect(r!.gasto).toBe(200 * dias);
    expect(r!.diasCorridos).toBe(dias);
    // R$ 200 por dia num mês inteiro passa de R$ 3.000 em qualquer mês.
    expect(Math.round(r!.projecaoGasto)).toBe(200 * r!.diasNoMes);
    expect(r!.ritmo).toBe("acima");
    expect(r!.resumo).toContain("projeção");
  });
});

describe("saúde da implantação", () => {
  it("aponta o que falta e avisa quando o gasto corre sem visita", async () => {
    const s = await saudeDoCliente(C);
    const estado = (chave: string) => s.itens.find((i) => i.chave === chave)?.estado;
    expect(estado("conta")).toBe("falta");
    expect(estado("whatsapp")).toBe("falta");
    expect(estado("capi")).toBe("falta");
    expect(s.pendencias).toBeGreaterThanOrEqual(4);
    // Sem nenhuma visita registrada na vida, é "falta script", não alarme de queda.
    expect(s.rastreamentoParado).toBeNull();

    // Com visitas antigas e gasto correndo agora, vira alarme.
    await prisma.clique.create({
      data: { clienteId: C, codigo: "VELHO", criadoEm: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) },
    });
    const s2 = await saudeDoCliente(C);
    expect(s2.rastreamentoParado?.gasto).toBeGreaterThan(0);
    expect(estadoDe(s2, "script")).toBe("alerta");
  });
});

function estadoDe(s: Awaited<ReturnType<typeof saudeDoCliente>>, chave: string) {
  return s.itens.find((i) => i.chave === chave)?.estado;
}

describe("tempo de resposta", () => {
  it("separa por faixa de espera e compara o fechamento", async () => {
    const agora = Date.now();
    const criar = async (esperaMin: number | null, fechado: boolean, i: number) => {
      const criadoEm = new Date(agora - 3 * 24 * 60 * 60 * 1000);
      const lead = await prisma.lead.create({
        data: {
          clienteId: C,
          telefone: `5519900000${String(i).padStart(3, "0")}`,
          mensagemEm: criadoEm,
          criadoEm,
          status: fechado ? "FECHADO" : "EM_ATENDIMENTO",
          valorVenda: fechado ? 1000 : null,
        },
      });
      if (esperaMin != null) {
        await prisma.evento.create({
          data: {
            clienteId: C,
            leadId: lead.id,
            tipo: "CONTATO",
            descricao: "teste",
            criadoEm: new Date(criadoEm.getTime() + esperaMin * MIN),
          },
        });
      }
    };

    // 6 rápidos (5 min), 4 deles fecharam; 6 devagar (3 dias), nenhum fechou; 2 sem resposta.
    for (let i = 0; i < 6; i++) await criar(5, i < 4, i);
    for (let i = 6; i < 12; i++) await criar(60 * 30, false, i);
    for (let i = 12; i < 14; i++) await criar(null, false, i);

    const t = await tempoDeResposta(C, new Date(agora - 7 * 24 * 60 * 60 * 1000), new Date());
    expect(t.leads).toBe(14);
    expect(t.semResposta).toBe(2);
    expect(t.faixas[0].leads).toBe(6); // até 10 min
    expect(t.faixas[0].fechados).toBe(4);
    expect(t.faixas[3].leads).toBe(6); // mais de 24 horas
    expect(t.medianaMin).toBeGreaterThan(5);
    expect(t.comparacao).toMatch(/1 hora/);
  });

  it("espera sai legível", () => {
    expect(formatarEspera(null)).toBe("—");
    expect(formatarEspera(0.5)).toBe("menos de 1 min");
    expect(formatarEspera(18)).toBe("18 min");
    expect(formatarEspera(200)).toBe("3h20");
    expect(formatarEspera(60 * 24 * 2)).toBe("2 dias");
  });
});
