"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirPlataforma, hashSenha } from "@/lib/auth";

export type EstadoPlataforma = { erro?: string; ok?: string; senha?: string; email?: string };

function slugDe(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Senha temporária fácil de digitar no celular. Quem recebe troca no primeiro acesso. */
function senhaTemporaria() {
  const palavras = ["lead", "anuncio", "painel", "funil", "clique", "venda", "cliente", "campanha"];
  const n = (max: number) => crypto.getRandomValues(new Uint32Array(1))[0] % max;
  return `${palavras[n(palavras.length)]}-${palavras[n(palavras.length)]}-${100 + n(900)}`;
}

const NovaAgencia = z.object({
  nome: z.string().min(2).max(80),
  adminNome: z.string().min(2).max(120),
  adminEmail: z.string().email(),
});

/**
 * Agência nova já nasce com o primeiro administrador. Sem ele a agência não tem
 * como entrar, e criar os dois separado é convite para agência órfã.
 */
export async function acaoCriarAgencia(
  _estado: EstadoPlataforma,
  formData: FormData,
): Promise<EstadoPlataforma> {
  await exigirPlataforma();

  const dados = NovaAgencia.safeParse({
    nome: String(formData.get("nome") ?? "").trim(),
    adminNome: String(formData.get("adminNome") ?? "").trim(),
    adminEmail: String(formData.get("adminEmail") ?? "").trim().toLowerCase(),
  });
  if (!dados.success) return { erro: "Preencha o nome da agência e o nome e e-mail do administrador." };
  const d = dados.data;

  if (await prisma.usuario.findUnique({ where: { email: d.adminEmail } })) {
    return { erro: "Já existe usuário com esse e-mail." };
  }

  let slug = slugDe(d.nome) || "agencia";
  if (await prisma.agencia.findUnique({ where: { slug } })) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const senha = senhaTemporaria();
  await prisma.agencia.create({
    data: {
      nome: d.nome,
      slug,
      usuarios: {
        create: {
          nome: d.adminNome,
          email: d.adminEmail,
          senhaHash: await hashSenha(senha),
          papel: "ADMIN",
        },
      },
    },
  });

  revalidatePath("/plataforma");
  return { ok: `${d.nome} foi criada.`, senha, email: d.adminEmail };
}

/** Desativar derruba todos os usuários da agência na próxima requisição. */
export async function acaoAlternarAgencia(formData: FormData): Promise<void> {
  const sessao = await exigirPlataforma();
  const id = String(formData.get("agenciaId") ?? "");
  // A própria agência de quem opera a plataforma não se desliga por aqui.
  if (id === sessao.agenciaId) return;

  const agencia = await prisma.agencia.findUnique({ where: { id } });
  if (!agencia) return;
  await prisma.agencia.update({ where: { id }, data: { ativa: !agencia.ativa } });
  revalidatePath("/plataforma");
}
