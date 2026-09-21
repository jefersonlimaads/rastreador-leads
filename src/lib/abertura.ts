import "server-only";
import { prisma } from "./prisma";
import { FUSO_PADRAO } from "./datas";

/**
 * Rascunho da abertura da proposta.
 *
 * A proposta sai depois da reunião de diagnóstico, com a conversa fresca e
 * nenhuma vontade de redigir parágrafo — e aí ou a abertura sai genérica, ou a
 * proposta demora dias. O histórico já está no sistema: interações do
 * prospect, observações e o diagnóstico da prospecção.
 *
 * O rascunho tem três partes, na ordem em que a pessoa precisa ler:
 *   1. o que ela trouxe, nas palavras dela;
 *   2. onde está a oportunidade — o problema e o que muda quando se resolve;
 *   3. como o trabalho acontece, para ela saber o que esperar.
 *
 * Nada é inventado sobre o cliente: as partes 1 e 2 saem de registro que
 * existe, e sem registro a seção não aparece. A parte 3 é como a agência
 * trabalha, que é fato sobre nós, não sobre ele.
 */

export type AberturaSugerida = {
  /** O rascunho pronto para o campo. */
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

/**
 * O que muda quando cada gap é resolvido.
 *
 * O diagnóstico já escreve o problema ("Site sem Pixel do Meta: não sabe quem
 * visita"); o que falta na proposta é o outro lado. Casado por palavra-chave
 * porque o gap é guardado como texto, não como código.
 */
const OPORTUNIDADE: { quando: RegExp; ganho: string }[] = [
  {
    quando: /pixel/i,
    ganho:
      "Com o Pixel e a API de Conversões ligados, o Meta passa a aprender com quem virou cliente de verdade — o custo por contato cai sem aumentar a verba.",
  },
  {
    quando: /tag do google|mede conversõ/i,
    ganho: "Medindo a conversão, dá para saber qual campanha traz cliente e qual só gasta.",
  },
  {
    quando: /não tem site/i,
    ganho:
      "Uma página de captura feita para um serviço só costuma converter mais do que mandar todo mundo para o perfil.",
  },
  {
    quando: /fora do ar|lento/i,
    ganho: "Página que abre rápido é a diferença entre o clique virar conversa e virar nada.",
  },
  {
    quando: /whatsapp nem formulário|botão de whatsapp/i,
    ganho:
      "Com botão de WhatsApp e formulário na página, a pessoa pede orçamento no impulso — que é quando ela decide.",
  },
  {
    quando: /página de links/i,
    ganho: "Um site próprio libera rastreamento e remarketing, que a página de links não permite.",
  },
  {
    quando: /cadeado|https/i,
    ganho: "Com o certificado resolvido, o navegador para de espantar quem chega.",
  },
  {
    quando: /nota .* no google|avaliaçõ/i,
    ganho:
      "Esse é o caso mais fácil: a prova social já existe, falta gente ver. Anúncio aqui só acelera o que a reputação já sustenta.",
  },
];

/**
 * Como o trabalho acontece. É o mesmo para todo cliente porque é o nosso
 * método, não o problema dele — e é o que responde à pergunta que vem logo
 * depois do preço: "e aí, o que acontece na prática?".
 */
const COMO_FUNCIONA = [
  "Primeiras duas semanas: rastreamento instalado na página, campanhas no ar e a primeira leitura de quanto custa cada contato.",
  "Do primeiro mês em diante: teste de criativo e de público, cortando o que sai caro e reforçando o que traz contato.",
  "Todo mês: relatório com quanto foi investido, quantos contatos chegaram, quanto custou cada um — e a conversa do que muda no mês seguinte.",
];

/** "12 de novembro", do jeito que se escreve numa carta. */
function porExtenso(data: Date, fuso: string) {
  return data.toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: fuso });
}

/** Termina em ponto, sem duplicar o que já tinha. */
const frase = (texto: string) => {
  const limpo = texto.trim().replace(/[;,]+$/, "");
  return /[.!?]$/.test(limpo) ? limpo : `${limpo}.`;
};

export async function aberturaSugerida(clienteId: string): Promise<AberturaSugerida> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: {
      nome: true,
      fuso: true,
      contatoNome: true,
      observacoes: true,
      reuniaoEm: true,
      interacoes: {
        orderBy: { criadoEm: "desc" },
        take: 8,
        select: { tipo: true, descricao: true, criadoEm: true },
      },
      diagnostico: { select: { resumo: true, gaps: true } },
    },
  });
  if (!cliente) return { texto: "", historico: [], pontos: [] };

  const fuso = cliente.fuso ?? FUSO_PADRAO;

  const historico = cliente.interacoes.map((i) => ({
    quando: porExtenso(i.criadoEm, fuso),
    tipo: ROTULO[i.tipo] ?? i.tipo,
    descricao: i.descricao,
  }));

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

  const blocos: string[] = [];

  // ——— 1. O que foi levantado ———
  const reuniao = cliente.interacoes.find((i) => i.tipo === "REUNIAO");
  const dataDaConversa = cliente.reuniaoEm ?? reuniao?.criadoEm ?? cliente.interacoes[0]?.criadoEm;

  const levantado = cliente.interacoes
    .filter((i) => i.descricao.trim().length > 15)
    .slice(0, 5)
    // Da mais antiga para a mais nova: é a ordem em que a conversa aconteceu.
    .reverse()
    .map((i) => `• ${frase(i.descricao)}`);

  if (levantado.length === 0 && cliente.observacoes?.trim()) {
    levantado.push(`• ${frase(cliente.observacoes)}`);
  }

  const tratamento = cliente.contatoNome ? `${cliente.contatoNome}, o` : "O";
  if (levantado.length > 0) {
    blocos.push(
      `${tratamento} que ficou da nossa conversa${dataDaConversa ? ` do dia ${porExtenso(dataDaConversa, fuso)}` : ""}:\n\n${levantado.join("\n")}`,
    );
  } else {
    blocos.push(
      `${tratamento} que conversamos até aqui está resumido abaixo. (Sem nada registrado ainda no histórico deste contato — escreva aqui os pontos da reunião.)`,
    );
  }

  // ——— 2. Onde está a oportunidade ———
  if (gaps.length > 0) {
    const linhas = gaps.slice(0, 4).map((g) => {
      const ganho = OPORTUNIDADE.find((o) => o.quando.test(g))?.ganho;
      return `• ${frase(g)}${ganho ? ` ${ganho}` : ""}`;
    });
    blocos.push(`Onde está a oportunidade:\n\n${linhas.join("\n")}`);
  }

  // ——— 3. Como o trabalho acontece ———
  blocos.push(
    `Como o trabalho acontece:\n\n${COMO_FUNCIONA.map((l, i) => `${i + 1}. ${l}`).join("\n")}`,
  );

  return { texto: blocos.join("\n\n"), historico, pontos };
}
