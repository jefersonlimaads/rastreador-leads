import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../prisma";
import type { LinhaLista } from "./lista";

/**
 * Importação de prospects de fora da plataforma — pensada para o Cowork, que
 * pesquisa no Google Maps pelo navegador e manda o resultado para cá.
 *
 * A chave é por agência e só existe inteira na hora de gerar: no banco fica o
 * hash. Trocar a chave derruba a antiga na hora.
 */

const hash = (chave: string) => createHash("sha256").update(chave).digest("hex");

export async function gerarChaveImportacao(agenciaId: string): Promise<string> {
  const chave = `jli_${randomBytes(24).toString("base64url")}`;
  await prisma.agencia.update({
    where: { id: agenciaId },
    data: { chaveImportacao: hash(chave), chaveImportacaoFim: chave.slice(-4), chaveImportacaoEm: new Date() },
  });
  return chave;
}

export async function revogarChaveImportacao(agenciaId: string) {
  await prisma.agencia.update({
    where: { id: agenciaId },
    data: { chaveImportacao: null, chaveImportacaoFim: null, chaveImportacaoEm: null },
  });
}

export async function agenciaPorChave(chave: string | null | undefined) {
  if (!chave || !chave.startsWith("jli_") || chave.length < 20) return null;
  return prisma.agencia.findFirst({
    where: { chaveImportacao: hash(chave), ativa: true },
    select: { id: true, nome: true },
  });
}

/** Texto curto, sem quebrar o banco com lixo: tudo que vem de fora passa por aqui. */
const texto = (max: number) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim().slice(0, max))
    .nullish();

export const EmpresaExterna = z.object({
  nome: z.string({ error: "falta o nome" }).trim().min(2, "falta o nome").max(160, "nome longo demais"),
  telefone: texto(40),
  site: texto(300),
  instagram: texto(60),
  endereco: texto(300),
  categoria: texto(80),
  mapsUrl: texto(600),
  notaGoogle: z.coerce.number().min(0).max(5).nullish().catch(null),
  avaliacoes: z.coerce.number().int().min(0).max(1_000_000).nullish().catch(null),
  // Análise já pronta (o Cowork escreve com IA): se vier, a plataforma usa.
  pontuacao: z.coerce.number().int().min(0).max(100).nullish().catch(null),
  resumo: texto(300),
  gaps: z.array(z.string().trim().max(300)).max(8).nullish().catch(null),
  briefing: texto(3000),
  mensagem: texto(1000),
});

export const PedidoImportacao = z.object({
  nicho: z.string().trim().min(2).max(80),
  cidade: z.string().trim().min(2).max(80),
  notaMinima: z.coerce.number().int().min(0).max(100).default(50),
  empresas: z.array(z.unknown()).min(1).max(50),
});

export type EmpresaExterna = z.infer<typeof EmpresaExterna>;

/** Empresa externa → linha da lista, com a análise pronta junto, se houver. */
export function paraLinha(e: EmpresaExterna): LinhaLista {
  const ig = e.instagram?.replace(/^.*instagram\.com\//i, "").replace(/[/?].*$/, "").replace(/^@/, "") || null;
  const site = e.site ? (/^https?:\/\//i.test(e.site) ? e.site : `https://${e.site}`) : null;
  return {
    nome: e.nome,
    telefone: e.telefone || null,
    site,
    instagram: ig,
    extra: {
      endereco: e.endereco || null,
      categoria: e.categoria || null,
      mapsUrl: e.mapsUrl && /^https?:\/\//i.test(e.mapsUrl) ? e.mapsUrl : null,
      notaGoogle: e.notaGoogle ?? null,
      avaliacoes: e.avaliacoes ?? null,
      pontuacao: e.pontuacao ?? null,
      resumo: e.resumo || null,
      gaps: e.gaps?.filter(Boolean) ?? null,
      briefing: e.briefing || null,
      mensagem: e.mensagem || null,
    },
  };
}

/**
 * Valida empresa por empresa: uma linha ruim não derruba o lote inteiro, só
 * fica de fora — e a resposta diz quantas e por quê.
 */
export function validarEmpresas(brutas: unknown[]) {
  const linhas: LinhaLista[] = [];
  const recusadas: { posicao: number; motivo: string }[] = [];
  brutas.forEach((b, i) => {
    const r = EmpresaExterna.safeParse(b);
    if (r.success) linhas.push(paraLinha(r.data));
    else {
      const erro = r.error.issues[0];
      recusadas.push({
        posicao: i + 1,
        motivo: typeof b !== "object" || b === null ? "não é uma empresa (esperado um objeto)" : (erro?.message ?? "inválida"),
      });
    }
  });
  return { linhas, recusadas };
}
