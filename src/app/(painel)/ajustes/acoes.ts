"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessao, exigirAdmin, hashSenha, conferirSenha, clienteDaAgencia } from "@/lib/auth";
import { cifrar } from "@/lib/cripto";
import { sincronizarGastos } from "@/lib/meta/marketing";

export type EstadoAjustes = { erro?: string; ok?: string };

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

  // Usuário de cliente precisa ser de um cliente desta agência.
  if (dados.data.papel !== "ADMIN" && dados.data.clienteId) {
    const cliente = await clienteDaAgencia(dados.data.clienteId, sessao.agenciaId);
    if (!cliente) return { erro: "Cliente inválido." };
  }

  const existe = await prisma.usuario.findUnique({ where: { email: dados.data.email } });
  if (existe) return { erro: "Já existe usuário com esse e-mail." };

  await prisma.usuario.create({
    data: {
      agenciaId: sessao.agenciaId,
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
  if (!(await clienteDaAgencia(clienteId, sessao.agenciaId))) return { erro: "Cliente inválido." };

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
  const sessao = await exigirAdmin();

  const dados = Credenciais.safeParse({
    clienteId: String(formData.get("clienteId") ?? ""),
    pixelId: String(formData.get("pixelId") ?? "").trim(),
    capiToken: String(formData.get("capiToken") ?? "").trim(),
    marketingToken: String(formData.get("marketingToken") ?? "").trim(),
    contaAnunciosId: String(formData.get("contaAnunciosId") ?? "").trim(),
  });
  if (!dados.success) return { erro: "Dados inválidos." };
  if (!(await clienteDaAgencia(dados.data.clienteId, sessao.agenciaId))) {
    return { erro: "Cliente inválido." };
  }

  // Sem a chave de criptografia o token não pode ser guardado: avisa em vez
  // de derrubar a tela.
  if ((dados.data.capiToken || dados.data.marketingToken) && !process.env.CHAVE_CRIPTOGRAFIA) {
    return { erro: "Falta configurar CHAVE_CRIPTOGRAFIA na Vercel. Nada foi salvo." };
  }

  // Campo em branco mantém o que já estava: o formulário nunca mostra o token.
  await prisma.cliente.update({
    where: { id: dados.data.clienteId },
    data: {
      pixelId: dados.data.pixelId || undefined,
      // Tokens entram no banco já cifrados. O pixel e a conta não são segredo.
      capiToken: dados.data.capiToken ? cifrar(dados.data.capiToken) : undefined,
      marketingToken: dados.data.marketingToken ? cifrar(dados.data.marketingToken) : undefined,
      contaAnunciosId: dados.data.contaAnunciosId || undefined,
    },
  });

  revalidatePath("/ajustes");
  return { ok: "Credenciais salvas." };
}

/**
 * Puxa o gasto do Meta na hora, sem esperar a rotina diária — e com 90 dias,
 * para o relatório já ter histórico logo depois de cadastrar o token.
 */
export async function acaoSincronizarMeta(
  _estado: EstadoAjustes,
  formData: FormData,
): Promise<EstadoAjustes> {
  const sessao = await exigirAdmin();
  const clienteId = String(formData.get("clienteId") ?? "");
  if (!(await clienteDaAgencia(clienteId, sessao.agenciaId))) return { erro: "Cliente inválido." };

  const r = await sincronizarGastos(clienteId, 90);
  if ("erro" in r) {
    return { erro: r.detalhe ? `${r.erro}: ${r.detalhe.slice(0, 200)}` : String(r.erro) };
  }
  revalidatePath("/anuncios");
  revalidatePath("/relatorios");
  return {
    ok:
      r.gravados === 0
        ? "Conectou no Meta, mas não há gasto nos últimos 90 dias nesta conta."
        : `Pronto: ${r.gravados} registros de anúncio por dia, de ${r.de.split("-").reverse().join("/")} a ${r.ate.split("-").reverse().join("/")}.`,
  };
}
