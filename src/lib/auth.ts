import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Papel } from "@prisma/client";

const COOKIE = "jl_sessao";
const DURACAO_DIAS = 7;

function segredo() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET não definido");
  return new TextEncoder().encode(s);
}

export type Sessao = {
  usuarioId: string;
  nome: string;
  papel: Papel;
  /** A fronteira do SaaS: toda consulta do painel parte daqui. */
  agenciaId: string;
  agenciaNome: string;
  clienteId: string | null;
  plataforma: boolean;
};

export async function hashSenha(senha: string) {
  return bcrypt.hash(senha, 10);
}

export async function conferirSenha(senha: string, hash: string) {
  return bcrypt.compare(senha, hash);
}

export async function criarSessao(usuarioId: string) {
  const expiraEm = new Date(Date.now() + DURACAO_DIAS * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({ usuarioId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiraEm)
    .sign(segredo());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiraEm,
    sameSite: "lax",
    path: "/",
  });
}

export async function encerrarSessao() {
  const store = await cookies();
  store.delete(COOKIE);
}

/**
 * Lê a sessão do cookie e confere o usuário no banco a cada requisição.
 * Usuário desativado perde o acesso na hora, sem esperar o cookie expirar.
 */
export async function sessaoAtual(): Promise<Sessao | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, segredo());
    const usuarioId = payload.usuarioId as string;
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: { agencia: { select: { nome: true, ativa: true } } },
    });
    // Agência desativada derruba todos os usuários dela na hora.
    if (!usuario || !usuario.ativo || !usuario.agencia.ativa) return null;

    return {
      usuarioId: usuario.id,
      nome: usuario.nome,
      papel: usuario.papel,
      agenciaId: usuario.agenciaId,
      agenciaNome: usuario.agencia.nome,
      clienteId: usuario.clienteId,
      plataforma: usuario.plataforma,
    };
  } catch {
    return null;
  }
}

/** Toda página e ação do painel começa por aqui. */
export async function exigirSessao(): Promise<Sessao> {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/login");
  return sessao;
}

export async function exigirAdmin(): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (sessao.papel !== "ADMIN") redirect("/hoje");
  return sessao;
}

/** Só o dono da plataforma: criar agências, convidar o primeiro administrador. */
export async function exigirPlataforma(): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (!sessao.plataforma) redirect("/negocio");
  return sessao;
}

/**
 * A pergunta que toda ação com id na mão precisa fazer: esse cliente é da
 * agência de quem está pedindo? Sem ela, bastaria trocar o id na requisição
 * para mexer no cliente de outra agência.
 */
export async function clienteDaAgencia(clienteId: string, agenciaId: string) {
  if (!clienteId) return null;
  return prisma.cliente.findFirst({ where: { id: clienteId, agenciaId } });
}

/** Versão que interrompe: para ação que não tem o que fazer sem o cliente. */
export async function exigirClienteDaAgencia(clienteId: string, sessao: Sessao) {
  const cliente = await clienteDaAgencia(clienteId, sessao.agenciaId);
  if (!cliente) throw new Error("Cliente não encontrado nesta agência");
  // Equipe do cliente alcança o próprio; colaborador, os liberados para ele.
  if (!(await podeVerCliente(sessao, cliente.id))) {
    throw new Error("Sem acesso a este cliente");
  }
  return cliente;
}

import { clientesPermitidos, podeVerCliente } from "./acesso";

export { COOKIE_CLIENTE } from "./cookies";
import { COOKIE_CLIENTE } from "./cookies";

/**
 * Cliente cujos dados a sessão pode ver. Admin escolhe pelo seletor, que grava a
 * escolha num cookie; os demais ficam presos ao próprio cliente, independente do
 * que vier na URL ou no cookie.
 */
export async function clienteEmFoco(sessao: Sessao, pedido?: string | null): Promise<string | null> {
  // Usuário do cliente fica preso ao próprio, venha o que vier na URL.
  if (sessao.clienteId) return sessao.clienteId;

  /* Equipe da agência escolhe entre os clientes que alcança — todos, para o
     administrador; os liberados, para o colaborador com lista. O pedido da URL
     ou do cookie só vale se estiver nessa lista: antes aceitava qualquer id,
     inofensivo com uma agência e vazamento com duas. */
  const permitidos = await clientesPermitidos(sessao);
  if (permitidos.length === 0) return null;

  const podem = new Set(permitidos.map((c) => c.id));
  const candidatos = [pedido, (await cookies()).get(COOKIE_CLIENTE)?.value];
  for (const id of candidatos) {
    if (id && podem.has(id)) return id;
  }
  return permitidos[0].id;
}

/** Barreira única de isolamento: nenhuma consulta do painel roda sem clienteId. */
export async function exigirCliente(pedido?: string | null) {
  const sessao = await exigirSessao();
  const clienteId = await clienteEmFoco(sessao, pedido);
  if (!clienteId) redirect("/ajustes");
  return { sessao, clienteId };
}

export function podeVerDinheiro(papel: Papel) {
  return papel === "ADMIN" || papel === "GESTOR";
}
