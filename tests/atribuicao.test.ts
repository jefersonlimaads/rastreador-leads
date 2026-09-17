/**
 * Critérios de aceite do escopo, rodando contra o banco local.
 * Precisa do banco no ar: npm run db:start
 *
 * Usa um cliente próprio (cliente-teste-auto) e limpa tudo no fim, para não
 * sujar os dados de desenvolvimento.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { cadastrarLead, sugerirClique, encerrarCliquesSemContato } from "../src/lib/atribuicao";
import { REGRAS } from "../src/lib/regras";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CLIENTE = "cliente-teste-auto";
const USUARIO = "usuario-teste-auto";
const minutos = (n: number) => n * 60 * 1000;

async function limpar() {
  await prisma.envioCapi.deleteMany({ where: { clienteId: CLIENTE } });
  await prisma.evento.deleteMany({ where: { clienteId: CLIENTE } });
  await prisma.lead.updateMany({ where: { clienteId: CLIENTE }, data: { leadAnteriorId: null } });
  await prisma.lead.deleteMany({ where: { clienteId: CLIENTE } });
  await prisma.clique.deleteMany({ where: { clienteId: CLIENTE } });
}

async function criarClique(codigo: string, adId: string, minutosAtras: number) {
  return prisma.clique.create({
    data: {
      clienteId: CLIENTE,
      codigo,
      adId,
      criadoEm: new Date(Date.now() - minutos(minutosAtras)),
    },
  });
}

beforeEach(async () => {
  await prisma.cliente.upsert({
    where: { id: CLIENTE },
    update: {},
    create: { id: CLIENTE, nome: "Cliente de teste automático" },
  });
  await prisma.usuario.upsert({
    where: { id: USUARIO },
    update: {},
    create: {
      id: USUARIO,
      nome: "Teste",
      email: "teste-auto@jl.ads",
      senhaHash: "x",
      papel: "ATENDENTE",
      clienteId: CLIENTE,
    },
  });
  await limpar();
});

afterAll(async () => {
  await limpar();
  await prisma.usuario.deleteMany({ where: { id: USUARIO } });
  await prisma.cliente.deleteMany({ where: { id: CLIENTE } });
  await prisma.$disconnect();
});

describe("atribuição", () => {
  it("regra 1: código na mensagem casa com o clique e a atribuição é exata", async () => {
    const clique = await criarClique("NF4T9", "ad-1", 3);

    const { lead } = await cadastrarLead({
      clienteId: CLIENTE,
      telefone: "5511900000001",
      mensagem: "Olá, vim pelo site. [NF4T9]",
      mensagemEm: new Date(),
      usuarioId: USUARIO,
    });

    expect(lead.atribuicao).toBe("EXATA");
    expect(lead.cliqueId).toBe(clique.id);

    const atualizado = await prisma.clique.findUnique({ where: { id: clique.id } });
    expect(atualizado?.status).toBe("CASADO");
  });

  it("dois anúncios no mesmo dia: cada lead fica com o anúncio certo", async () => {
    await criarClique("AAAA1", "ad-A", 40);
    await criarClique("BBBB2", "ad-B", 10);

    const a = await cadastrarLead({
      clienteId: CLIENTE,
      telefone: "5511900000002",
      mensagem: "quero orçamento [AAAA1]",
      mensagemEm: new Date(),
      usuarioId: USUARIO,
    });
    const b = await cadastrarLead({
      clienteId: CLIENTE,
      telefone: "5511900000003",
      mensagem: "quero orçamento [BBBB2]",
      mensagemEm: new Date(),
      usuarioId: USUARIO,
    });

    const leadA = await prisma.lead.findUnique({
      where: { id: a.lead.id },
      include: { clique: true },
    });
    const leadB = await prisma.lead.findUnique({
      where: { id: b.lead.id },
      include: { clique: true },
    });

    expect(leadA?.clique?.adId).toBe("ad-A");
    expect(leadB?.clique?.adId).toBe("ad-B");
  });

  it("regra 2: sem código, sugere o clique da janela de 30 minutos", async () => {
    const dentro = await criarClique("DENTR", "ad-dentro", REGRAS.janelaAtribuicaoMin - 5);
    await criarClique("FORAA", "ad-fora", REGRAS.janelaAtribuicaoMin + 20);

    const sugestao = await sugerirClique({
      clienteId: CLIENTE,
      mensagem: "Oi, quanto custa?",
      mensagemEm: new Date(),
    });

    expect(sugestao.atribuicao).toBe("PROVAVEL");
    expect(sugestao.clique?.id).toBe(dentro.id);
  });

  it("regra 3: sem código e sem clique na janela, atribuição desconhecida", async () => {
    await criarClique("VELHO", "ad-velho", 240);

    const { lead } = await cadastrarLead({
      clienteId: CLIENTE,
      telefone: "5511900000004",
      mensagem: "Bom dia!",
      mensagemEm: new Date(),
      usuarioId: USUARIO,
    });

    expect(lead.atribuicao).toBe("DESCONHECIDA");
    expect(lead.cliqueId).toBeNull();
  });

  it("a janela conta pelo horário da mensagem, não pelo do cadastro", async () => {
    // Clique de 3 horas atrás; mensagem de 3 horas atrás; cadastro agora.
    await criarClique("TARDE", "ad-tarde", 185);
    const mensagemEm = new Date(Date.now() - minutos(180));

    const { lead } = await cadastrarLead({
      clienteId: CLIENTE,
      telefone: "5511900000005",
      mensagem: "oi, tenho interesse",
      mensagemEm,
      usuarioId: USUARIO,
    });

    expect(lead.atribuicao).toBe("PROVAVEL");
  });

  it("regra 4: telefone com lead aberto vira evento de retorno, não lead novo", async () => {
    await cadastrarLead({
      clienteId: CLIENTE,
      telefone: "5511900000006",
      mensagem: "primeira mensagem",
      mensagemEm: new Date(),
      usuarioId: USUARIO,
    });

    const segundo = await cadastrarLead({
      clienteId: CLIENTE,
      telefone: "5511900000006",
      mensagem: "voltei",
      mensagemEm: new Date(),
      usuarioId: USUARIO,
    });

    expect(segundo.tipo).toBe("retorno");

    const leads = await prisma.lead.count({
      where: { clienteId: CLIENTE, telefone: "5511900000006" },
    });
    expect(leads).toBe(1);

    const retornos = await prisma.evento.count({
      where: { clienteId: CLIENTE, tipo: "RETORNO" },
    });
    expect(retornos).toBe(1);
  });

  it("regra 5: lead perdido há mais de 60 dias volta como oportunidade nova", async () => {
    const primeiro = await cadastrarLead({
      clienteId: CLIENTE,
      telefone: "5511900000007",
      mensagem: "primeira vez",
      mensagemEm: new Date(),
      usuarioId: USUARIO,
    });

    const antigo = new Date(Date.now() - (REGRAS.reabrirLeadDias + 10) * 24 * 60 * 60 * 1000);
    await prisma.lead.update({
      where: { id: primeiro.lead.id },
      data: { status: "PERDIDO", motivoPerda: "sumiu", fechadoEm: antigo, criadoEm: antigo },
    });

    await criarClique("NOVO1", "ad-novo", 2);
    const segundo = await cadastrarLead({
      clienteId: CLIENTE,
      telefone: "5511900000007",
      mensagem: "voltei meses depois [NOVO1]",
      mensagemEm: new Date(),
      usuarioId: USUARIO,
    });

    expect(segundo.tipo).toBe("reaberto");
    expect(segundo.lead.id).not.toBe(primeiro.lead.id);
    expect(segundo.lead.leadAnteriorId).toBe(primeiro.lead.id);
    expect(segundo.lead.atribuicao).toBe("EXATA");
  });

  it("regra 12: clique sem mensagem em 24 horas vira clique sem contato", async () => {
    await criarClique("ANTIG", "ad-antigo", 60 * (REGRAS.cliqueSemContatoHoras + 1));
    await criarClique("RECEN", "ad-recente", 30);

    const encerrados = await encerrarCliquesSemContato(CLIENTE);
    expect(encerrados).toBe(1);

    const antigo = await prisma.clique.findUnique({
      where: { clienteId_codigo: { clienteId: CLIENTE, codigo: "ANTIG" } },
    });
    const recente = await prisma.clique.findUnique({
      where: { clienteId_codigo: { clienteId: CLIENTE, codigo: "RECEN" } },
    });

    expect(antigo?.status).toBe("SEM_CONTATO");
    expect(recente?.status).toBe("PENDENTE");
  });

  it("o mesmo clique não é usado por dois leads", async () => {
    await criarClique("UNICO", "ad-unico", 5);

    await cadastrarLead({
      clienteId: CLIENTE,
      telefone: "5511900000008",
      mensagem: "primeiro [UNICO]",
      mensagemEm: new Date(),
      usuarioId: USUARIO,
    });

    const segundo = await cadastrarLead({
      clienteId: CLIENTE,
      telefone: "5511900000009",
      mensagem: "segundo, com o mesmo código [UNICO]",
      mensagemEm: new Date(),
      usuarioId: USUARIO,
    });

    expect(segundo.lead.atribuicao).not.toBe("EXATA");
  });
});
