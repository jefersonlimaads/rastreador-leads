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
  clienteId: string | null;
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
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario || !usuario.ativo) return null;

    return {
      usuarioId: usuario.id,
      nome: usuario.nome,
      papel: usuario.papel,
      clienteId: usuario.clienteId,
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

/**
 * Cliente cujos dados a sessão pode ver. Admin escolhe pelo seletor; os demais
 * ficam presos ao próprio cliente, independente do que vier na URL.
 */
export async function clienteEmFoco(sessao: Sessao, pedido?: string | null): Promise<string | null> {
  if (sessao.papel === "ADMIN") {
    if (pedido) return pedido;
    const primeiro = await prisma.cliente.findFirst({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true },
    });
    return primeiro?.id ?? null;
  }
  return sessao.clienteId;
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
