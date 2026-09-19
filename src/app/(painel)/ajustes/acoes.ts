"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizarContaAnuncios, normalizarTelefone } from "@/lib/telefone";
import { exigirSessao, exigirAdmin, hashSenha, conferirSenha, clienteDaAgencia } from "@/lib/auth";
import { chaveValida, cifrar } from "@/lib/cripto";
import { sincronizarGastos, testarToken } from "@/lib/meta/marketing";

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
  revalidatePath("/conta");
  return { ok: "Acesso criado. Passe o e-mail e a senha inicial para a pessoa." };
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
  });
  if (!dados.success) return { erro: "Dados inválidos." };
  if (!(await clienteDaAgencia(dados.data.clienteId, sessao.agenciaId))) {
    return { erro: "Cliente inválido." };
  }

  // Sem a chave de criptografia o token não pode ser guardado: avisa em vez
  // de derrubar a tela.
  if (dados.data.capiToken && !chaveValida()) {
    return {
      erro: "CHAVE_CRIPTOGRAFIA não está configurada ou está com valor errado na Vercel. Nada foi salvo.",
    };
  }

  // Campo em branco mantém o que já estava: o formulário nunca mostra o token.
  await prisma.cliente.update({
    where: { id: dados.data.clienteId },
    data: {
      pixelId: dados.data.pixelId || undefined,
      // Token entra no banco já cifrado. O pixel não é segredo.
      capiToken: dados.data.capiToken ? cifrar(dados.data.capiToken) : undefined,
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
  const periodo = `de ${r.de.split("-").reverse().join("/")} a ${r.ate.split("-").reverse().join("/")}`;
  const contas = r.contas === 1 ? "1 conta" : `${r.contas} contas`;
  const falhou = r.falhas.length
    ? ` Não deu para ler ${r.falhas.map((f) => f.conta).join(", ")}: confira se estão atribuídas ao usuário do sistema.`
    : "";
  return {
    ok:
      (r.gravados === 0
        ? `Conectou no Meta (${contas}), mas não há gasto nos últimos 90 dias.`
        : `Pronto: ${r.gravados} registros de anúncio por dia (${contas}), ${periodo}.`) + falhou,
  };
}

/**
 * Token do Meta da agência: um só, testado no Meta antes de guardar. Token
 * errado não substitui o que está funcionando.
 */
export async function acaoSalvarTokenAgencia(
  _estado: EstadoAjustes,
  formData: FormData,
): Promise<EstadoAjustes> {
  const sessao = await exigirAdmin();
  const token = String(formData.get("token") ?? "").trim();
  if (token.length < 20) return { erro: "Cole o token inteiro." };
  if (!chaveValida()) {
    return { erro: "CHAVE_CRIPTOGRAFIA não está configurada ou está com valor errado na Vercel. Nada foi salvo." };
  }

  const teste = await testarToken(token);
  if ("erro" in teste) return { erro: `O Meta recusou o token: ${teste.erro}` };

  await prisma.agencia.update({ where: { id: sessao.agenciaId }, data: { metaToken: cifrar(token) } });
  revalidatePath("/ajustes");
  revalidatePath("/conta");
  return {
    ok: `Conectado como ${teste.nome}. ${teste.contas} ${teste.contas === 1 ? "conta de anúncios visível" : "contas de anúncios visíveis"}.`,
  };
}

/** Liga uma conta de anúncios ao cliente. Valor do formulário: "act_123|Nome" ou só o ID digitado. */
export async function acaoVincularConta(
  _estado: EstadoAjustes,
  formData: FormData,
): Promise<EstadoAjustes> {
  const sessao = await exigirAdmin();
  const clienteId = String(formData.get("clienteId") ?? "");
  if (!(await clienteDaAgencia(clienteId, sessao.agenciaId))) return { erro: "Cliente inválido." };

  const [escolhida, nomeEscolhido] = String(formData.get("conta") ?? "").split("|");
  const contaId = normalizarContaAnuncios(escolhida || String(formData.get("contaDigitada") ?? ""));
  if (!contaId) return { erro: "Escolha a conta na lista ou digite o número dela." };

  // A mesma conta em dois clientes somaria o gasto duas vezes na visão geral.
  const emUso = await prisma.contaAnuncios.findFirst({
    where: { contaId, cliente: { agenciaId: sessao.agenciaId } },
    select: { clienteId: true, cliente: { select: { nome: true } } },
  });
  if (emUso) {
    return {
      erro:
        emUso.clienteId === clienteId
          ? "Essa conta já está neste cliente."
          : `Essa conta já está ligada a ${emUso.cliente.nome}.`,
    };
  }

  await prisma.contaAnuncios.create({ data: { clienteId, contaId, nome: nomeEscolhido?.trim() || null } });
  revalidatePath("/ajustes");
  return { ok: "Conta ligada. Puxe os dados do Meta para trazer o histórico dela." };
}

export async function acaoDesvincularConta(formData: FormData): Promise<void> {
  const sessao = await exigirAdmin();
  const id = String(formData.get("id") ?? "");
  const conta = await prisma.contaAnuncios.findFirst({
    where: { id, cliente: { agenciaId: sessao.agenciaId } },
    select: { id: true },
  });
  if (!conta) return;
  // O gasto já gravado fica: é histórico do cliente, e some sozinho do período.
  await prisma.contaAnuncios.delete({ where: { id: conta.id } });
  revalidatePath("/ajustes");
}

/** WhatsApp de atendimento: onde chegam os leads. É o número que o script da página usa. */
export async function acaoSalvarNumero(
  _estado: EstadoAjustes,
  formData: FormData,
): Promise<EstadoAjustes> {
  const sessao = await exigirAdmin();
  const clienteId = String(formData.get("clienteId") ?? "");
  if (!(await clienteDaAgencia(clienteId, sessao.agenciaId))) return { erro: "Cliente inválido." };
  const numero = normalizarTelefone(String(formData.get("numero") ?? ""));
  if (!numero) return { erro: "Número inválido. Use DDD + número." };

  const atual = await prisma.numeroWhatsapp.findFirst({ where: { clienteId }, orderBy: { id: "asc" } });
  if (atual) await prisma.numeroWhatsapp.update({ where: { id: atual.id }, data: { numero } });
  else await prisma.numeroWhatsapp.create({ data: { clienteId, numero, rotulo: "Atendimento" } });

  revalidatePath("/ajustes");
  return { ok: "Número salvo. Se o script já está na página, atualize o data-numero dele também." };
}
