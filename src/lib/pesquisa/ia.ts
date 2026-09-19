import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { DadosProspect, Qualificacao } from "./qualificar";

/**
 * Diagnóstico com o Claude: parte da nota por regra e dos sinais coletados, e
 * devolve nota ajustada, gaps em linguagem comercial, briefing para quem vai
 * abordar e uma primeira mensagem de WhatsApp escrita para aquela empresa.
 *
 * A resposta vem por ferramenta (tool use) com formato fixo: nada de ler texto
 * solto e torcer para ser JSON. Se a chave faltar ou a chamada falhar, quem
 * chama segue com a versão por regra.
 */

const MODELO = process.env.CLAUDE_MODELO ?? "claude-sonnet-5";

export function iaConfigurada() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const FERRAMENTA: Anthropic.Tool = {
  name: "registrar_diagnostico",
  description: "Registra o diagnóstico comercial do prospect.",
  input_schema: {
    type: "object",
    properties: {
      pontuacao: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "Chance de contratar gestão de tráfego agora (0 a 100).",
      },
      resumo: { type: "string", description: "Uma frase: quem é e a principal oportunidade." },
      gaps: {
        type: "array",
        items: { type: "string" },
        maxItems: 5,
        description: "Gaps concretos de marketing, do mais forte para o mais fraco, uma frase cada.",
      },
      briefing: {
        type: "string",
        description:
          "Briefing para quem vai abordar: contexto, gaps, o gancho da primeira mensagem, objeções prováveis e o próximo passo. Em tópicos curtos.",
      },
      mensagem: {
        type: "string",
        description: "Primeira mensagem de WhatsApp, pronta para enviar.",
      },
    },
    required: ["pontuacao", "resumo", "gaps", "briefing", "mensagem"],
  },
};

export async function qualificarComIa(
  dados: DadosProspect,
  base: Qualificacao,
  quem: { assinatura: string; agencia: string },
): Promise<Qualificacao | null> {
  if (!iaConfigurada()) return null;
  const cliente = new Anthropic();

  const contexto = {
    empresa: dados.nome,
    categoria: dados.categoria,
    nicho_buscado: dados.nicho,
    cidade: dados.cidade,
    tem_telefone: Boolean(dados.telefone),
    site: dados.site,
    nota_google: dados.notaGoogle,
    avaliacoes_google: dados.avaliacoes,
    instagram: dados.instagram ?? dados.sinais.instagram,
    sinais_do_site: dados.sinais,
    nota_por_regra: base.pontuacao,
    gaps_por_regra: base.gaps,
  };

  try {
    const resposta = await cliente.messages.create(
      {
        model: MODELO,
        max_tokens: 1500,
        tools: [FERRAMENTA],
        tool_choice: { type: "tool", name: FERRAMENTA.name },
        system: [
          `Você é o analista comercial da ${quem.agencia}, agência de tráfego pago (Meta Ads e Google Ads) e marketing criativo para negócios locais no Brasil.`,
          "Seu trabalho: olhar os dados públicos de um negócio e dizer se vale abordá-lo, por quê, e como.",
          "Nota: parta da nota por regra e ajuste no máximo 20 pontos, para cima ou para baixo, com base no que os dados mostram. Negócio que já vende e ainda não mede nem anuncia bem vale mais; quem já tem estrutura completa de anúncios provavelmente já tem gestor.",
          "Use só os dados fornecidos. Não invente números, clientes, faturamento nem fatos que não estão aqui. Se um dado não existe, não afirme nada sobre ele.",
          `Mensagem de WhatsApp: em português do Brasil, tom de conversa entre profissionais, até 450 caracteres, sem 'Prezado', sem promessa de resultado, sem emoji ou no máximo um. Cite UM gap concreto de forma gentil (sem constranger), ofereça uma conversa curta ou um diagnóstico rápido e termine com uma pergunta simples. Quem assina: ${quem.assinatura}.`,
          "Briefing: tópicos curtos, em português, prontos para ler em 30 segundos antes de mandar a mensagem.",
        ].join("\n"),
        messages: [
          {
            role: "user",
            content: `Dados do prospect (JSON):\n${JSON.stringify(contexto, null, 2)}\n\nRegistre o diagnóstico.`,
          },
        ],
      },
      { timeout: 45000 },
    );

    const uso = resposta.content.find((c) => c.type === "tool_use");
    if (!uso || uso.type !== "tool_use") return null;
    const r = uso.input as Partial<Qualificacao>;
    if (typeof r.pontuacao !== "number" || !r.mensagem || !r.briefing) return null;
    return {
      pontuacao: Math.max(0, Math.min(100, Math.round(r.pontuacao))),
      resumo: String(r.resumo ?? base.resumo).slice(0, 300),
      gaps: Array.isArray(r.gaps) ? r.gaps.map(String).slice(0, 5) : base.gaps,
      briefing: String(r.briefing).slice(0, 3000),
      mensagem: String(r.mensagem).slice(0, 1000),
    };
  } catch (erro) {
    console.error("[pesquisa/ia] falha", String(erro).slice(0, 300));
    return null;
  }
}
