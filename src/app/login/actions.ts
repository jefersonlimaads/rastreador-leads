"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { conferirSenha, criarSessao, encerrarSessao } from "@/lib/auth";

const Entrada = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

export type EstadoLogin = { erro?: string };

export async function entrar(_estado: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const dados = Entrada.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    senha: String(formData.get("senha") ?? ""),
  });

  if (!dados.success) {
    return { erro: "Informe e-mail e senha." };
  }

  const usuario = await prisma.usuario.findUnique({ where: { email: dados.data.email } });

  // Mensagem única para e-mail errado e senha errada: não entrega quem existe.
  const generico = { erro: "E-mail ou senha incorretos." };
  if (!usuario || !usuario.ativo) return generico;

  const confere = await conferirSenha(dados.data.senha, usuario.senhaHash);
  if (!confere) return generico;

  await criarSessao(usuario.id);
  redirect("/hoje");
}

export async function sair() {
  await encerrarSessao();
  redirect("/login");
}
