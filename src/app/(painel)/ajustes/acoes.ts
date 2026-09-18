"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessao, exigirAdmin, hashSenha, conferirSenha } from "@/lib/auth";
import { normalizarTelefone } from "@/lib/telefone";

export type EstadoAjustes = { erro?: string; ok?: string };

const NovoCliente = z.object({
  nome: z.string().min(2).max(120),
  numero: z.string().min(8),
  contaAnunciosId: z.string().max(64).optional(),
});

export async function acaoCriarCliente(
  _estado: EstadoAjustes,
  formData: FormData,
): Promise<EstadoAjustes> {
  await exigirAdmin();

  const dados = NovoCliente.safeParse({
    nome: String(formData.get("nome") ?? "").trim(),
    numero: String(formData.get("numero") ?? ""),
    contaAnunciosId: String(formData.get("contaAnunciosId") ?? "").trim(),
  });
  if (!dados.success) return { erro: "Confira o nome e o número do WhatsApp." };

  const numero = normalizarTelefone(dados.data.numero);
  if (!numero) return { erro: "Número de WhatsApp inválido." };

  const cliente = await prisma.cliente.create({
    data: {
      nome: dados.data.nome,
      contaAnunciosId: dados.data.contaAnunciosId || null,
      numeros: { create: { numero, rotulo: "Principal" } },
    },
  });

  revalidatePath("/ajustes");
  return { ok: `Cliente ${cliente.nome} criado. Instale o script com o id ${cliente.id}.` };
}

const NovoUsuario = z.object({
  nome: z.string().min(2).max(120),
  email: z.string().email(),
  senha: z.string().min(8).max(72),
  papel: z.enum(["ADMIN", "GESTOR", "ATENDENTE"]),
  clienteId: z.string().optional(),
});

export async function acaoCriarUsuario(
  _estado: EstadoAjustes,
  formData: FormData,
): Promise<EstadoAjustes> {
  const sessao = await exigirSessao();

  const dados = NovoUsuario.safeParse({
    nome: String(formData.get("nome") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    senha: String(formData.get("senha") ?? ""),
    papel: String(formData.get("papel") ?? "ATENDENTE"),
    clienteId: String(formData.get("clienteId") ?? ""),
  });
  if (!dados.success) return { erro: "Confira os dados. A senha precisa de 8 caracteres." };

  // Gestor só cria usuário do próprio cliente, e nunca administrador.
  if (sessao.papel === "ATENDENTE") return { erro: "Sem permissão." };
  if (sessao.papel === "GESTOR") {
    if (dados.data.papel === "ADMIN") return { erro: "Gestor não cria administrador." };
    if (dados.data.clienteId !== sessao.clienteId) return { erro: "Cliente inválido." };
  }

  const existe = await prisma.usuario.findUnique({ where: { email: dados.data.email } });
  if (existe) return { erro: "Já existe usuário com esse e-mail." };

  await prisma.usuario.create({
    data: {
      nome: dados.data.nome,
      email: dados.data.email,
      senhaHash: await hashSenha(dados.data.senha),
      papel: dados.data.papel,
      clienteId: dados.data.papel === "ADMIN" ? null : dados.data.clienteId || null,
    },
  });

  revalidatePath("/ajustes");
  return { ok: "Usuário criado." };
}

const TrocaSenha = z
  .object({
    atual: z.string().min(1),
    nova: z.string().min(10).max(72),
    confirmacao: z.string(),
  })
  .refine((d) => d.nova === d.confirmacao, { message: "confirmação diferente" });

/** Troca da própria senha. Ninguém troca a senha de outro usuário por aqui. */
export async function acaoTrocarSenha(
  _estado: EstadoAjustes,
  formData: FormData,
): Promise<EstadoAjustes> {
  const sessao = await exigirSessao();

  const dados = TrocaSenha.safeParse({
    atual: String(formData.get("atual") ?? ""),
    nova: String(formData.get("nova") ?? ""),
    confirmacao: String(formData.get("confirmacao") ?? ""),
  });
  if (!dados.success) {
    return { erro: "A nova senha precisa de 10 caracteres e as duas precisam ser iguais." };
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: sessao.usuarioId } });
  if (!usuario) return { erro: "Usuário não encontrado." };

  const confere = await conferirSenha(dados.data.atual, usuario.senhaHash);
  if (!confere) return { erro: "A senha atual está errada." };

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { senhaHash: await hashSenha(dados.data.nova) },
  });

  return { ok: "Senha trocada." };
}

/** O funil do cliente muda o que ele vê na tela de confirmação e no pipeline. */
export async function acaoTrocarFunil(
  _estado: EstadoAjustes,
  formData: FormData,
): Promise<EstadoAjustes> {
  const sessao = await exigirSessao();
  if (sessao.papel === "ATENDENTE") return { erro: "Sem permissão." };

  const clienteId = String(formData.get("clienteId") ?? "");
  const funil = String(formData.get("funil") ?? "");
  if (funil !== "SIMPLES" && funil !== "COMPLETO") return { erro: "Funil inválido." };
  if (sessao.papel === "GESTOR" && clienteId !== sessao.clienteId) {
    return { erro: "Cliente inválido." };
  }

  await prisma.cliente.update({ where: { id: clienteId }, data: { funil } });
  revalidatePath("/ajustes");
  revalidatePath("/pipeline");
  return { ok: "Funil atualizado." };
}

const Credenciais = z.object({
  clienteId: z.string().min(1),
  pixelId: z.string().max(64).optional(),
  capiToken: z.string().max(500).optional(),
  marketingToken: z.string().max(500).optional(),
  contaAnunciosId: z.string().max(64).optional(),
});

export async function acaoSalvarCredenciais(
  _estado: EstadoAjustes,
  formData: FormData,
): Promise<EstadoAjustes> {
  await exigirAdmin();

  const dados = Credenciais.safeParse({
    clienteId: String(formData.get("clienteId") ?? ""),
    pixelId: String(formData.get("pixelId") ?? "").trim(),
    capiToken: String(formData.get("capiToken") ?? "").trim(),
    marketingToken: String(formData.get("marketingToken") ?? "").trim(),
    contaAnunciosId: String(formData.get("contaAnunciosId") ?? "").trim(),
  });
  if (!dados.success) return { erro: "Dados inválidos." };

  // Campo em branco mantém o que já estava: o formulário nunca mostra o token.
  await prisma.cliente.update({
    where: { id: dados.data.clienteId },
    data: {
      pixelId: dados.data.pixelId || undefined,
      capiToken: dados.data.capiToken || undefined,
      marketingToken: dados.data.marketingToken || undefined,
      contaAnunciosId: dados.data.contaAnunciosId || undefined,
    },
  });

  revalidatePath("/ajustes");
  return { ok: "Credenciais salvas." };
}
