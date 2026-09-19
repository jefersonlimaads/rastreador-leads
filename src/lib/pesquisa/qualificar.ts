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

type Gap = { texto: string; gancho: string };

export function qualificarPorRegra(d: DadosProspect, assinatura: string): Qualificacao {
  const s = d.sinais;
  let nota = 35;
  const gaps: Gap[] = [];
  const pontos: string[] = [];

  // Negócio que já vende: tem demanda para escalar.
  // Sem o dado de avaliações (mapa aberto, lista colada), fica no meio: não
  // pune a empresa pela fonte não saber.
  const av = d.avaliacoes ?? 0;
  nota += d.avaliacoes == null ? 8 : av >= 100 ? 20 : av >= 30 ? 14 : av >= 10 ? 8 : 2;
  if (d.notaGoogle != null) nota += d.notaGoogle >= 4.5 ? 8 : d.notaGoogle >= 4 ? 4 : d.notaGoogle < 3.5 ? -10 : 0;
  const bemAvaliado = d.notaGoogle != null && d.notaGoogle >= 4.3;
  if (bemAvaliado && av > 0 && av < 40) {
    gaps.push({
      texto: `Nota ${d.notaGoogle!.toFixed(1)} no Google com só ${av} avaliações: bem avaliado, mas pouca gente conhece.`,
      gancho: `vocês têm nota ${d.notaGoogle!.toFixed(1)} no Google, mas ainda pouca gente conhece o trabalho`,
    });
  }
  if (av >= 30) pontos.push(`${av} avaliações no Google (nota ${d.notaGoogle?.toFixed(1) ?? "?"})`);

  // Presença digital: o que falta é a oportunidade.
  if (s.situacao === "sem_site") {
    nota += 8;
    gaps.push({
      texto: "Não tem site: depende só do Instagram e do Google Maps para converter.",
      gancho: "vocês ainda não têm um site próprio, e parte dos contatos se perde no caminho até o WhatsApp",
    });
  } else if (s.situacao === "fora_do_ar") {
    nota += 4;
    gaps.push({
      texto: "Site fora do ar ou muito lento: quem clica não encontra nada.",
      gancho: "o site de vocês não abriu aqui para mim, e quem chega por anúncio ou pelo Google desiste na hora",
    });
  } else {
    if (!s.pixelMeta && s.naoConfirmavel) {
      // Não dá para afirmar: vira ponto a conferir, não gancho de abordagem.
      nota += 7;
      pontos.push(`site em ${s.plataforma ?? "plataforma que carrega por script"}: confira o pixel com a extensão Meta Pixel Helper antes de citar`);
    } else if (!s.pixelMeta) {
      nota += 15;
      gaps.push({
        texto: "Site sem Pixel do Meta: não sabe quem visita, nem consegue fazer remarketing.",
        gancho: "o site ainda não tem o Pixel do Meta, então quem visita e não chama no WhatsApp some sem deixar rastro",
      });
    }
    if (!s.googleTag && !s.naoConfirmavel) {
      nota += 5;
      gaps.push({
        texto: "Sem tag do Google: não mede conversões nem aparece para quem já visitou.",
        gancho: "o site ainda não mede as conversões do Google",
      });
    }
    if (s.naoConfirmavel) {
      // Botão de WhatsApp de Wix e afins entra por script: não dá para afirmar.
    } else if (!s.botaoWhatsapp && !s.formulario) {
      nota += 5;
      gaps.push({
        texto: "Site sem WhatsApp nem formulário: o visitante não tem como pedir orçamento.",
        gancho: "o site não tem um botão de WhatsApp nem formulário, e pelo celular isso faz muita gente desistir",
      });
    } else if (!s.botaoWhatsapp) {
      nota += 3;
      gaps.push({
        texto: "Site sem botão de WhatsApp: pelo celular, falar com a empresa dá trabalho.",
        gancho: "não achei um botão de WhatsApp no site, e pelo celular isso faz diferença",
      });
    }
    if (s.paginaDeLinks) {
      nota += 5;
      gaps.push({
        texto: "Usa página de links no lugar de site: pouca conversão e nenhum rastreamento.",
        gancho: "vocês usam uma página de links no lugar de site, o que limita bastante a conversão",
      });
    }
    if (!s.https) {
      gaps.push({
        texto: "Site sem cadeado (https): o navegador avisa que não é seguro.",
        gancho: "o navegador marca o site de vocês como não seguro",
      });
    }
    // Já anuncia com estrutura: provavelmente tem gestor. Conversa de otimização.
    if (s.pixelMeta && (s.googleAds || s.gtm)) {
      nota -= 15;
      pontos.push("já tem pixel e tag de anúncios (provável que alguém já cuide do tráfego)");
    }
  }
  if (d.instagram || s.instagram) nota += 5;
  if (!d.telefone) {
    nota -= 20;
    gaps.push({
      texto: "Sem telefone público: abordagem só por Instagram ou e-mail.",
      gancho: "",
    });
  }

  const pontuacao = Math.max(0, Math.min(100, Math.round(nota)));
  const primeiro = gaps.find((g) => g.gancho);
  const tipo = d.categoria ?? d.nicho;
  const resumo = primeiro
    ? `${tipo} em ${d.cidade}. ${primeiro.texto.split(":")[0]}.`
    : `${tipo} em ${d.cidade}, com presença digital já estruturada.`;

  const briefing = [
    `Quem é: ${d.nome} (${tipo}, ${d.cidade}).`,
    pontos.length ? `Sinais: ${pontos.join("; ")}.` : null,
    gaps.length ? `Gaps encontrados:\n${gaps.map((g) => `- ${g.texto}`).join("\n")}` : "Nenhum gap óbvio no site.",
    primeiro
      ? "Gancho da abordagem: comece pelo primeiro gap, com um exemplo concreto do que a empresa perde hoje. Ofereça um diagnóstico rápido, sem compromisso."
      : "Gancho da abordagem: elogie a estrutura e ofereça uma análise de desempenho das campanhas atuais.",
    d.instagram || s.instagram ? `Antes de mandar: olhe o Instagram (@${d.instagram ?? s.instagram}) para citar algo recente do perfil.` : null,
    "Confira também a Biblioteca de Anúncios (link na ficha) para saber se já anunciam.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const abertura = `Oi, tudo bem? Aqui é ${assinatura}. Encontrei vocês pesquisando ${d.nicho.toLowerCase()} em ${d.cidade.split(",")[0]}`;
  const mensagem = primeiro
    ? `${abertura}${bemAvaliado ? " e vi a ótima avaliação no Google" : ""}. Reparei que ${primeiro.gancho}. Trabalho com tráfego pago para ${d.nicho.toLowerCase()} e posso te mostrar, numa conversa de 10 minutos, o que daria para ajustar. Faz sentido?`
    : `${abertura}. Trabalho com tráfego pago para ${d.nicho.toLowerCase()} e posso te mostrar, numa conversa de 10 minutos, onde os anúncios de vocês podem render mais. Faz sentido?`;

  return { pontuacao, resumo, gaps: gaps.map((g) => g.texto), briefing, mensagem };
}
