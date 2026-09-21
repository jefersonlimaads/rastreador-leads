/**
 * Quem abriu: gente ou robô.
 *
 * Existe porque "proposta aberta" é um sinal de venda — é o que faz você ligar
 * dizendo "vi que você deu uma olhada". Se o número contar robô, a ligação sai
 * errada e o pipeline mente.
 *
 * E robô acontece o tempo todo: ao colar o link no WhatsApp, o próprio
 * WhatsApp busca a página para montar aquele cartãozinho de prévia. Isso
 * acontece antes de qualquer pessoa tocar no link. O mesmo vale para Telegram,
 * Slack, iMessage e o pré-carregamento do navegador.
 *
 * Na dúvida, conta como robô: deixar de registrar uma visita real é bem menos
 * grave do que dizer que o cliente leu a proposta quando ele não leu.
 */

const ROBOS = [
  // Prévia de link em mensageiro e rede social.
  "whatsapp",
  "facebookexternalhit",
  "facebot",
  "telegrambot",
  "twitterbot",
  "slackbot",
  "discordbot",
  "linkedinbot",
  "skypeuripreview",
  "applebot",
  "redditbot",
  "pinterest",
  "embedly",
  "quora link preview",
  "vkshare",
  "w3c_validator",
  // Buscadores e monitoramento.
  "googlebot",
  "bingbot",
  "yandex",
  "duckduckbot",
  "baiduspider",
  "ahrefsbot",
  "semrushbot",
  "petalbot",
  "uptimerobot",
  // Ferramenta e script.
  "curl/",
  "wget",
  "python-requests",
  "node-fetch",
  "axios/",
  "go-http-client",
  "okhttp",
  "headlesschrome",
  "phantomjs",
  "lighthouse",
  "vercel",
];

/** Palavras genéricas, conferidas depois das específicas. */
const GENERICOS = ["bot", "crawler", "spider", "preview", "scraper", "monitor"];

export function ehRobo(userAgent: string | null | undefined): boolean {
  // Navegador de gente sempre manda user-agent. Vazio é script.
  if (!userAgent || userAgent.trim().length < 10) return true;

  const ua = userAgent.toLowerCase();
  if (ROBOS.some((r) => ua.includes(r))) return true;
  return GENERICOS.some((g) => ua.includes(g));
}
