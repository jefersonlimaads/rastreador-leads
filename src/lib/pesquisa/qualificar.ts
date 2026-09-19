import type { SinaisSite } from "./site";

/**
 * Nota de 0 a 100: chance de o negócio contratar gestão de tráfego agora.
 *
 * O melhor prospect é o negócio que já vende (bem avaliado, com volume de
 * avaliações) e ainda não mede nem anuncia direito (sem pixel, sem tag). Quem
 * já tem pixel e tag de anúncio provavelmente já tem alguém cuidando: vale
 * menos, e a conversa é outra. Sem telefone, não dá nem para abordar.
 *
 * Esta regra roda sempre, sem depender de nada externo. Com a chave do Claude,
 * ela é o ponto de partida que a IA refina e transforma em briefing e mensagem.
 */

export type DadosProspect = {
  nome: string;
  nicho: string;
  cidade: string;
  categoria: string | null;
  telefone: string | null;
  site: string | null;
  notaGoogle: number | null;
  avaliacoes: number | null;
  instagram: string | null;
  sinais: SinaisSite;
};

export type Qualificacao = {
  pontuacao: number;
  resumo: string;
  gaps: string[];
  briefing: string;
  mensagem: string;
};

export function qualificarPorRegra(d: DadosProspect, assinatura: string): Qualificacao {
  const s = d.sinais;
  let nota = 35;
  const gaps: string[] = [];
  const pontos: string[] = [];

  // Negócio que já vende: tem demanda para escalar.
  const av = d.avaliacoes ?? 0;
  nota += av >= 100 ? 20 : av >= 30 ? 14 : av >= 10 ? 8 : 2;
  if (d.notaGoogle != null) nota += d.notaGoogle >= 4.5 ? 8 : d.notaGoogle >= 4 ? 4 : d.notaGoogle < 3.5 ? -10 : 0;
  if (d.notaGoogle != null && d.notaGoogle >= 4.3 && av > 0 && av < 40) {
    gaps.push(`Nota ${d.notaGoogle.toFixed(1)} no Google com só ${av} avaliações: bem avaliado, mas pouca gente conhece.`);
  }
  if (av >= 30) pontos.push(`${av} avaliações no Google (nota ${d.notaGoogle?.toFixed(1) ?? "?"})`);

  // Presença digital: o que falta é a oportunidade.
  if (s.situacao === "sem_site") {
    nota += 8;
    gaps.push("Não tem site: depende só do Instagram e do Google Maps para converter.");
  } else if (s.situacao === "fora_do_ar") {
    nota += 4;
    gaps.push("Site fora do ar ou muito lento: quem clica não encontra nada.");
  } else {
    if (!s.pixelMeta) {
      nota += 15;
      gaps.push("Site sem Pixel do Meta: não sabe quem visita, nem consegue fazer remarketing.");
    }
    if (!s.googleTag) {
      nota += 5;
      gaps.push("Sem tag do Google: não mede conversões nem aparece para quem já visitou.");
    }
    if (!s.botaoWhatsapp && !s.formulario) {
      nota += 5;
      gaps.push("Site sem WhatsApp nem formulário: o visitante não tem como pedir orçamento.");
    } else if (!s.botaoWhatsapp) {
      nota += 3;
      gaps.push("Site sem botão de WhatsApp: pelo celular, falar com a empresa dá trabalho.");
    }
    if (s.paginaDeLinks) {
      nota += 5;
      gaps.push("Usa página de links no lugar de site: pouca conversão e nenhum rastreamento.");
    }
    if (!s.https) gaps.push("Site sem cadeado (https): o navegador avisa que não é seguro.");
    // Já anuncia com estrutura: provavelmente tem gestor. Conversa de otimização.
    if (s.pixelMeta && (s.googleAds || s.gtm)) {
      nota -= 15;
      pontos.push("já tem pixel e tag de anúncios (provável que alguém já cuide do tráfego)");
    }
  }
  if (d.instagram || s.instagram) nota += 5;
  if (!d.telefone) {
    nota -= 20;
    gaps.push("Sem telefone público no Google: abordagem só por Instagram ou e-mail.");
  }

  const pontuacao = Math.max(0, Math.min(100, Math.round(nota)));
  const primeiro = gaps[0];
  const resumo = primeiro
    ? `${d.categoria ?? d.nicho} em ${d.cidade}. ${primeiro.split(":")[0]}.`
    : `${d.categoria ?? d.nicho} em ${d.cidade}, com presença digital já estruturada.`;

  const briefing = [
    `Quem é: ${d.nome} (${d.categoria ?? d.nicho}, ${d.cidade}).`,
    pontos.length ? `Sinais: ${pontos.join("; ")}.` : null,
    gaps.length ? `Gaps encontrados:\n${gaps.map((g) => `- ${g}`).join("\n")}` : "Nenhum gap óbvio no site.",
    primeiro
      ? `Gancho da abordagem: comece pelo primeiro gap, com um exemplo concreto do que ele perde hoje. Ofereça um diagnóstico rápido, sem compromisso.`
      : `Gancho da abordagem: elogie a estrutura e ofereça uma análise de desempenho das campanhas atuais.`,
    `Antes de mandar: confira a Biblioteca de Anúncios (link na ficha) para saber se ele já anuncia.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const gancho = primeiro
    ? primeiro.split(":")[0].toLowerCase().replace(/^site sem /, "o site de vocês está sem ").replace(/^não tem site/, "vocês ainda não têm site")
    : null;
  const mensagem = gancho
    ? `Oi, tudo bem? Aqui é ${assinatura}. Vi a ${d.nome} no Google — ótima avaliação! Reparei que ${gancho}, e isso costuma deixar cliente na mesa. Trabalho com tráfego pago para ${d.nicho.toLowerCase()} e posso te mostrar em 10 minutos o que daria para melhorar. Faz sentido conversarmos?`
    : `Oi, tudo bem? Aqui é ${assinatura}. Vi a ${d.nome} no Google e gostei do que vocês fazem. Trabalho com tráfego pago para ${d.nicho.toLowerCase()} e posso te mostrar em 10 minutos onde as campanhas podem render mais. Faz sentido conversarmos?`;

  return { pontuacao, resumo, gaps, briefing, mensagem };
}
