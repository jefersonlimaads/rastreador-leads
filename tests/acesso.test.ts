/**
 * Quem alcança qual cliente. Restringir é ato explícito do administrador:
 * quem nunca teve lista não perde acesso quando a lista passa a existir.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { clientesPermitidos, definirAcesso, podeVerCliente } from "../src/lib/acesso";
import type { Sessao } from "../src/lib/auth";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const AG = "agencia-acesso";
const OUTRA = "agencia-acesso-outra";
const A = "cliente-acesso-a";
const B = "cliente-acesso-b";
const FORA = "cliente-acesso-fora";

const sessao = (over: Partial<Sessao>): Sessao =>
  ({
    usuarioId: "u-colab",
    agenciaId: AG,
    clienteId: null,
    papel: "GESTOR",
    nome: "Colaborador",
    plataforma: false,
    ...over,
  }) as Sessao;

async function limpar() {
  await prisma.acessoCliente.deleteMany({ where: { cliente: { agenciaId: { in: [AG, OUTRA] } } } });
  await prisma.usuario.deleteMany({ where: { agenciaId: { in: [AG, OUTRA] } } });
  await prisma.cliente.deleteMany({ where: { id: { in: [A, B, FORA] } } });
  await prisma.agencia.deleteMany({ where: { id: { in: [AG, OUTRA] } } });
}

beforeEach(async () => {
  await limpar();
  await prisma.agencia.create({ data: { id: AG, nome: "Acesso", slug: AG } });
  await prisma.agencia.create({ data: { id: OUTRA, nome: "Outra", slug: OUTRA } });
  await prisma.cliente.create({ data: { id: A, agenciaId: AG, nome: "Cliente A" } });
  await prisma.cliente.create({ data: { id: B, agenciaId: AG, nome: "Cliente B" } });
  await prisma.cliente.create({ data: { id: FORA, agenciaId: OUTRA, nome: "De outra agência" } });
  await prisma.usuario.create({
    data: { id: "u-colab", agenciaId: AG, nome: "Colaborador", email: "colab@teste.com", senhaHash: "x", papel: "GESTOR" },
  });
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

describe("acesso por cliente", () => {
  it("colaborador sem lista alcança todos os da agência", async () => {
    const lista = await clientesPermitidos(sessao({}));
    expect(lista.map((c) => c.id).sort()).toEqual([A, B]);
    expect(await podeVerCliente(sessao({}), A)).toBe(true);
  });

  it("com lista, alcança só os liberados", async () => {
    await definirAcesso({ agenciaId: AG, usuarioId: "u-colab", clienteIds: [A] });

    expect((await clientesPermitidos(sessao({}))).map((c) => c.id)).toEqual([A]);
    expect(await podeVerCliente(sessao({}), A)).toBe(true);
    expect(await podeVerCliente(sessao({}), B)).toBe(false);
  });

  it("lista vazia devolve o acesso a todos", async () => {
    await definirAcesso({ agenciaId: AG, usuarioId: "u-colab", clienteIds: [A] });
    await definirAcesso({ agenciaId: AG, usuarioId: "u-colab", clienteIds: [] });
    expect((await clientesPermitidos(sessao({}))).map((c) => c.id).sort()).toEqual([A, B]);
  });

  it("cliente de outra agência nunca entra, nem se pedido na lista", async () => {
    await definirAcesso({ agenciaId: AG, usuarioId: "u-colab", clienteIds: [A, FORA] });
    expect((await clientesPermitidos(sessao({}))).map((c) => c.id)).toEqual([A]);
    expect(await podeVerCliente(sessao({}), FORA)).toBe(false);
  });

  it("administrador não é restringido", async () => {
    await definirAcesso({ agenciaId: AG, usuarioId: "u-colab", clienteIds: [A] });
    const admin = sessao({ papel: "ADMIN" });
    expect((await clientesPermitidos(admin)).map((c) => c.id).sort()).toEqual([A, B]);
    expect(await podeVerCliente(admin, B)).toBe(true);
  });

  it("usuário do cliente alcança o próprio e nada mais", async () => {
    const doCliente = sessao({ clienteId: A, papel: "ATENDENTE" });
    expect((await clientesPermitidos(doCliente)).map((c) => c.id)).toEqual([A]);
    expect(await podeVerCliente(doCliente, B)).toBe(false);
  });

  it("cliente inativo some da lista de quem quer que seja", async () => {
    await prisma.cliente.update({ where: { id: B }, data: { ativo: false } });
    expect((await clientesPermitidos(sessao({ papel: "ADMIN" }))).map((c) => c.id)).toEqual([A]);
  });
});
