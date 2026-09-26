import "server-only";
import { prisma } from "./prisma";
import type { Sessao } from "./auth";

/**
 * Quem alcança qual cliente.
 *
 * Três situações, e só três:
 *
 *   administrador da agência — todos os clientes dela;
 *   colaborador da agência   — os clientes liberados para ele, ou todos quando
 *                              nenhum foi liberado (colaborador sem restrição);
 *   usuário do cliente       — o próprio cliente, e nada mais.
 *
 * A regra do "nenhum liberado = todos" existe para o cadastro antigo continuar
 * funcionando: quem nunca teve lista não perde acesso quando a lista passa a
 * existir. Restringir é um ato explícito do administrador.
 */

/** Os clientes que a sessão pode ver, já filtrados pela agência. */
export async function clientesPermitidos(sessao: Sessao): Promise<{ id: string; nome: string }[]> {
  // Usuário do cliente: o próprio, e só se ainda for da agência e estiver ativo.
  if (sessao.clienteId) {
    const c = await prisma.cliente.findFirst({
      where: { id: sessao.clienteId, agenciaId: sessao.agenciaId, ativo: true },
      select: { id: true, nome: true },
    });
    return c ? [c] : [];
  }

  const todos = await prisma.cliente.findMany({
    where: { agenciaId: sessao.agenciaId, ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  if (sessao.papel === "ADMIN") return todos;

  const liberados = await prisma.acessoCliente.findMany({
    where: { usuarioId: sessao.usuarioId },
    select: { clienteId: true },
  });
  if (liberados.length === 0) return todos;

  const permitidos = new Set(liberados.map((a) => a.clienteId));
  return todos.filter((c) => permitidos.has(c.id));
}

/** Uma pergunta só, para as guardas: esta sessão alcança este cliente? */
export async function podeVerCliente(sessao: Sessao, clienteId: string): Promise<boolean> {
  if (!clienteId) return false;
  if (sessao.clienteId) return sessao.clienteId === clienteId;

  const daAgencia = await prisma.cliente.findFirst({
    where: { id: clienteId, agenciaId: sessao.agenciaId },
    select: { id: true },
  });
  if (!daAgencia) return false;
  if (sessao.papel === "ADMIN") return true;

  const quantos = await prisma.acessoCliente.count({ where: { usuarioId: sessao.usuarioId } });
  if (quantos === 0) return true;

  const liberado = await prisma.acessoCliente.findFirst({
    where: { usuarioId: sessao.usuarioId, clienteId },
    select: { id: true },
  });
  return Boolean(liberado);
}

/** Define a lista de um colaborador. Lista vazia devolve o acesso a todos. */
export async function definirAcesso(params: {
  agenciaId: string;
  usuarioId: string;
  clienteIds: string[];
}) {
  const usuario = await prisma.usuario.findFirst({
    where: { id: params.usuarioId, agenciaId: params.agenciaId, clienteId: null },
    select: { id: true, papel: true },
  });
  // Administrador vê tudo por definição, e usuário do cliente já é preso ao seu.
  if (!usuario || usuario.papel === "ADMIN") return null;

  const validos = await prisma.cliente.findMany({
    where: { id: { in: params.clienteIds }, agenciaId: params.agenciaId },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.acessoCliente.deleteMany({ where: { usuarioId: usuario.id } }),
    prisma.acessoCliente.createMany({
      data: validos.map((c) => ({ usuarioId: usuario.id, clienteId: c.id })),
    }),
  ]);

  return validos.length;
}
