/**
 * Diagnóstico do site de um prospect: o que ele já usa (ou não) de marketing.
 *
 * analisarHtml é pura — recebe o HTML e devolve os sinais —, para ser testada
 * sem internet. baixarSite faz a parte da rede, com tempo e tamanho limitados:
 * site lento ou gigante não trava a busca inteira.
 */

export type SinaisSite = {
  /** Site respondeu? Sem site ou fora do ar também é um sinal. */
  situacao: "sem_site" | "fora_do_ar" | "ok";
  https: boolean;
  pixelMeta: boolean;
  googleTag: boolean;
  googleAds: boolean;
  gtm: boolean;
  botaoWhatsapp: boolean;
  formulario: boolean;
  /** Página de links (Linktree e similares) em vez de site. */
  paginaDeLinks: boolean;
  /**
   * Site montado por script (Wix, apps em React...): pixel e botão de WhatsApp
   * podem entrar depois que a página abre e não aparecem na leitura. Nesses,
   * "não achei" não quer dizer "não tem".
   */
  naoConfirmavel: boolean;
  plataforma: string | null;
  titulo: string | null;
  descricao: string | null;
  instagram: string | null;
  facebook: string | null;
};

const VAZIO: Omit<SinaisSite, "situacao"> = {
  https: false,
  pixelMeta: false,
  googleTag: false,
  googleAds: false,
  gtm: false,
  botaoWhatsapp: false,
  formulario: false,
  paginaDeLinks: false,
  naoConfirmavel: false,
  plataforma: null,
  titulo: null,
  descricao: null,
  instagram: null,
  facebook: null,
};

const NAO_PERFIL_IG = new Set(["p", "reel", "reels", "explore", "stories", "tv", "accounts", "sharer"]);
const NAO_PAGINA_FB = new Set(["tr", "sharer", "sharer.php", "plugins", "dialog", "share", "profile.php", "events", "groups"]);

function limpar(texto: string | undefined | null, max = 160) {
  if (!texto) return null;
  const t = texto
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return t ? t.slice(0, max) : null;
}

export function analisarHtml(html: string, url: string): SinaisSite {
  const h = html;
  const perfilIg = [...h.matchAll(/instagram\.com\/([A-Za-z0-9_.]{2,30})/gi)]
    .map((m) => m[1].replace(/\.$/, ""))
    .find((u) => !NAO_PERFIL_IG.has(u.toLowerCase()));
  const paginaFb = [...h.matchAll(/facebook\.com\/([A-Za-z0-9.\-]{2,60})/gi)]
    .map((m) => m[1])
    .find((u) => !NAO_PAGINA_FB.has(u.toLowerCase()));

  const gerador = h.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i)?.[1] ?? "";
  const plataforma =
    /wordpress/i.test(gerador) || /wp-content\//i.test(h)
      ? "WordPress"
      : /wix\.com|_wixCIDX|wixstatic/i.test(h)
        ? "Wix"
        : /webflow/i.test(gerador) || /webflow\.com/i.test(h)
          ? "Webflow"
          : /cdn\.shopify\.com/i.test(h)
            ? "Shopify"
            : /nuvemshop|lojanuvem/i.test(h)
              ? "Nuvemshop"
              : /linktr\.ee|linktree/i.test(url + gerador)
                ? "Linktree"
                : limpar(gerador, 40);

  return {
    ...VAZIO,
    situacao: "ok",
    https: url.startsWith("https://"),
    pixelMeta: /connect\.facebook\.net\/[^"'\s]*\/fbevents\.js|fbq\(\s*['"]init/i.test(h),
    googleTag: /googletagmanager\.com\/gtag\/js|gtag\(\s*['"]config/i.test(h),
    googleAds: /['"]AW-\d{6,}/i.test(h),
    gtm: /GTM-[A-Z0-9]{4,}/.test(h),
    botaoWhatsapp: /wa\.me\/|api\.whatsapp\.com\/send|whatsapp:\/\/send/i.test(h),
    formulario: /<form[\s>]/i.test(h),
    paginaDeLinks: /linktr\.ee|beacons\.ai|bio\.link|linkin\.bio/i.test(url),
    naoConfirmavel:
      plataforma === "Wix" ||
      // Página quase vazia com um contêiner de app: o conteúdo vem todo por script.
      (h.length < 8000 && /<div id=["'](root|__next|app)["']/i.test(h)),
    plataforma,
    titulo: limpar(h.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1], 120),
    descricao: limpar(
      h.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ??
        h.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)/i)?.[1],
    ),
    instagram: perfilIg ?? null,
    facebook: paginaFb ?? null,
  };
}

/**
 * Só endereço público, por http ou https. O link vem do Google, mas quem
 * cadastra a empresa lá é qualquer um: sem esta trava, um "site" apontando
 * para a rede interna faria o servidor visitar o que não deve.
 */
export function enderecoPublico(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (/^\[?[0-9a-f:]+\]?$/i.test(host) && host.includes(":")) return false; // IPv6 literal
    const ip = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ip) {
      const [a, b] = [Number(ip[1]), Number(ip[2])];
      if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function baixarSite(url: string | null): Promise<SinaisSite> {
  if (!url) return { ...VAZIO, situacao: "sem_site" };
  if (!enderecoPublico(url)) return { ...VAZIO, situacao: "fora_do_ar" };
  // Link de Instagram cadastrado como "site" no Google: não é site.
  if (/instagram\.com|facebook\.com/i.test(url)) {
    const perfil = url.match(/instagram\.com\/([A-Za-z0-9_.]{2,30})/i)?.[1] ?? null;
    return { ...VAZIO, situacao: "sem_site", instagram: perfil };
  }
  try {
    // Redirecionamentos seguidos à mão: cada destino passa pela mesma trava.
    let atual = url;
    let r: Response | null = null;
    for (let saltos = 0; saltos < 5; saltos++) {
      r = await fetch(atual, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(9000),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; jlads-diagnostico/1.0; +https://rastreador-leads.vercel.app)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      const destino = r.status >= 300 && r.status < 400 ? r.headers.get("location") : null;
      if (!destino) break;
      atual = new URL(destino, atual).toString();
      if (!enderecoPublico(atual)) return { ...VAZIO, situacao: "fora_do_ar" };
    }
    if (!r || !r.ok || !r.body) return { ...VAZIO, situacao: "fora_do_ar" };

    // Lê no máximo 1,5 MB: o que interessa (tags, links) está no começo.
    const leitor = r.body.getReader();
    const partes: Uint8Array[] = [];
    let total = 0;
    while (total < 1_500_000) {
      const { done, value } = await leitor.read();
      if (done) break;
      partes.push(value);
      total += value.length;
    }
    leitor.cancel().catch(() => {});
    const html = new TextDecoder("utf-8", { fatal: false }).decode(
      Buffer.concat(partes.map((p) => Buffer.from(p))),
    );
    return analisarHtml(html, atual);
  } catch {
    return { ...VAZIO, situacao: "fora_do_ar" };
  }
}

/** Link da Biblioteca de Anúncios já filtrado pela empresa: conferência com um clique. */
export function linkBibliotecaAnuncios(nome: string) {
  const q = encodeURIComponent(nome);
  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${q}&search_type=keyword_unordered`;
}
