import "server-only";
import { prisma } from "./prisma";
import { FUSO_PADRAO } from "./datas";

/**
 * Rascunho da abertura da proposta.
 *
 * A abertura é o que prova que a proposta foi escrita para aquela pessoa, e
 * não copiada. Mas quem escreve chega nela depois da reunião, com a conversa
 * ainda fresca e nenhuma vontade de redigir parágrafo — e aí ou sai genérica,
 * ou a proposta demora dias.
 *
 * Então o sistema monta um rascunho com o que já está registrado: a data da
 * conversa, o que foi anotado nela, e o que o diagnóstico apontou. Nada é
 * inventado: cada frase sai de um registro que existe. O texto entra no campo
 * como ponto de partida, para ser corrigido — é rascunho, não resposta final.
 */

export type AberturaSugerida = {
  /** O rascunho pronto para o campo. Vazio quando não há o que dizer. */
  texto: string;
  /** O material cru, para quem quiser completar à mão. */
  historico: { quando: string; tipo: string; descricao: string }[];
  /** O que o diagnóstico da prospecção apontou. */
  pontos: string[];
};

const ROTULO: Record<string, string> = {
  MENSAGEM: "Mensagem",
  LIGACAO: "Ligação",
  REUNIAO: "Reunião",
  EMAIL: "E-mail",
  NOTA: "Nota",
};

/** "12 de novembro", do jeito que se escreve numa carta. */
function porExtenso(data: Date, fuso: string) {
  return data.toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: fuso });
}

/** Primeira letra minúscula: a frase continua, não recomeça. */
const emenda = (texto: string) => texto.charAt(0).toLowerCase() + texto.slice(1);

/** Tira o ponto final para a frase poder continuar. */
const semPonto = (texto: string) => texto.replace(/[.;]+\s*$/, "");

export async function aberturaSugerida(clienteId: string): Promise<AberturaSugerida> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: {
      nome: true,
      fuso: true,
      nicho: true,
      contatoNome: true,
      observacoes: true,
      reuniaoEm: true,
      interacoes: {
        orderBy: { criadoEm: "desc" },
        take: 8,
        select: { tipo: true, descricao: true, criadoEm: true },
      },
      diagnostico: { select: { resumo: true, gaps: true, briefing: true } },
    },
  });
  if (!cliente) return { texto: "", historico: [], pontos: [] };

  const fuso = cliente.fuso ?? FUSO_PADRAO;

  const historico = cliente.interacoes.map((i) => ({
    quando: porExtenso(i.criadoEm, fuso),
    tipo: ROTULO[i.tipo] ?? i.tipo,
    descricao: i.descricao,
  }));

  // Gaps do diagnóstico: o que falta no marketing dele, achado na prospecção.
  const gaps = Array.isArray(cliente.diagnostico?.gaps)
    ? (cliente.diagnostico.gaps as unknown[])
        .map((g) =>
          typeof g === "string"
            ? g
            : typeof g === "object" && g !== null && "texto" in g
              ? String((g as { texto: unknown }).texto)
              : null,
        )
        .filter((g): g is string => !!g)
    : [];
  const pontos = [...gaps, ...(cliente.diagnostico?.resumo ? [cliente.diagnostico.resumo] : [])];

  const partes: string[] = [];

  /* 1. Onde a conversa aconteceu. A reunião marcada é a referência mais forte;
   *    sem ela, vale a última interação registrada. */
  const reuniao = cliente.interacoes.find((i) => i.tipo === "REUNIAO");
  const ultima = cliente.interacoes[0];
  const dataDaConversa = cliente.reuniaoEm ?? reuniao?.criadoEm ?? ultima?.criadoEm ?? null;

  if (dataDaConversa) {
    const tratamento = cliente.contatoNome ? `${cliente.contatoNome}, ` : "";
    partes.push(
      `${tratamento}${tratamento ? "n" : "N"}a nossa conversa do dia ${porExtenso(dataDaConversa, fuso)}, algumas coisas ficaram claras.`,
    );
  } else {
    partes.push(`${cliente.contatoNome ? `${cliente.contatoNome}, ` : ""}pelo que conversamos até aqui, algumas coisas ficaram claras.`);
  }

  /* 2. O que foi levantado. Sai das anotações da conversa, que é o que você
   *    escreveu ouvindo a pessoa — e é literalmente a linguagem dela. */
  const anotacoes = cliente.interacoes
    .filter((i) => i.descricao.trim().length > 15)
    .slice(0, 3)
    .map((i) => semPonto(i.descricao.trim()));

  if (anotacoes.length === 1) {
    partes.push(`Você comentou que ${emenda(anotacoes[0])}.`);
  } else if (anotacoes.length > 1) {
    partes.push(
      `Entre o que você trouxe: ${anotacoes.map(emenda).join("; ")}.`,
    );
  } else if (cliente.observacoes?.trim()) {
    partes.push(`Do que anotamos: ${emenda(semPonto(cliente.observacoes.trim()))}.`);
  }

  /* 3. O que olhamos por fora. Só entra quando existe diagnóstico: é a parte
   *    que mostra que houve trabalho antes da proposta. */
  if (gaps.length > 0) {
    // Só o que o diagnóstico realmente olhou: o que está no ar do lado dele.
    // Dizer "olhamos a concorrência" seria uma frase bonita e falsa.
    partes.push(
      `Olhando por fora o que hoje está no ar, ${gaps.length === 1 ? "um ponto chamou" : "alguns pontos chamaram"} atenção: ${gaps.slice(0, 3).map((g) => emenda(semPonto(g))).join("; ")}.`,
    );
  }

  /* 4. A ponte para o que vem abaixo, que é a proposta em si. */
  partes.push("O que segue abaixo é o caminho que eu proponho para resolver isso.");

  return { texto: partes.join("\n\n"), historico, pontos };
}
