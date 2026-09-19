import "server-only";
import type { EmpresaGoogle } from "./google";

/**
 * Busca gratuita de empresas no OpenStreetMap: mapa aberto, sem conta, sem
 * chave, sem custo. Cobre uma parte dos negócios de cada cidade (bem menos que
 * o Google Maps), com nome, telefone, site e, às vezes, Instagram.
 *
 * Dois serviços públicos, usados com moderação e identificação, como pedem as
 * regras de uso deles: o Nominatim acha a cidade; o Overpass lista o que há
 * nela do tipo pedido.
 */

const AGENTE = "jlads-prospeccao/1.0 (+https://rastreador-leads.vercel.app)";
const SERVIDORES = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

/**
 * Nicho em português → marcações do OpenStreetMap. Quem não está no dicionário
 * é buscado pelo nome ("studio de tatuagem" → nome contém "tatuagem").
 */
const MARCACOES: { termos: RegExp; filtros: string[]; generico?: boolean }[] = [
  { termos: /odont|dentist|dental|ortodont/i, filtros: ['["amenity"="dentist"]', '["healthcare"="dentist"]'] },
  { termos: /est[ée]tica|beleza|sobrancelha|depila|harmoniza/i, filtros: ['["shop"="beauty"]', '["amenity"="clinic"]["name"~"est[eé]tica",i]'] },
  { termos: /sal[ãa]o|cabele|barbear/i, filtros: ['["shop"="hairdresser"]', '["shop"="beauty"]'] },
  {
    termos: /cl[ií]nica|m[ée]dic|consult[óo]rio/i,
    filtros: ['["amenity"="clinic"]', '["amenity"="doctors"]', '["healthcare"="clinic"]'],
    // "Clínica odontológica" é dentista, não qualquer clínica: só vale sozinho.
    generico: true,
  },
  { termos: /psic/i, filtros: ['["healthcare"="psychotherapist"]', '["healthcare:speciality"~"psych"]', '["name"~"psic",i]'] },
  { termos: /nutri/i, filtros: ['["healthcare"="nutrition_counselling"]', '["name"~"nutri",i]'] },
  { termos: /fisio/i, filtros: ['["healthcare"="physiotherapist"]', '["name"~"fisio",i]'] },
  { termos: /advoga|jur[ií]dic/i, filtros: ['["office"="lawyer"]'] },
  { termos: /arquitet|interiores/i, filtros: ['["office"="architect"]', '["shop"="interior_decoration"]'] },
  { termos: /pilates|academia|crossfit|fitness/i, filtros: ['["leisure"="fitness_centre"]', '["sport"~"pilates|fitness|crossfit"]'] },
  { termos: /pet|veterin/i, filtros: ['["shop"="pet"]', '["amenity"="veterinary"]'] },
  { termos: /imobili|corretor/i, filtros: ['["office"="estate_agent"]'] },
  { termos: /idioma|ingl[êe]s|escola de/i, filtros: ['["amenity"="language_school"]', '["amenity"="school"]["name"~"idioma|english|ingl",i]'] },
  { termos: /restaurante|hamburg|pizzar/i, filtros: ['["amenity"="restaurant"]', '["amenity"="fast_food"]'] },
  { termos: /[óo]tica/i, filtros: ['["shop"="optician"]'] },
  { termos: /contab/i, filtros: ['["office"="accountant"]'] },
  { termos: /fot[óo]graf|filmmaker|v[íi]deo/i, filtros: ['["craft"="photographer"]', '["shop"="photo"]', '["office"="photographer"]'] },
];

/** Palavra principal do nicho, sem acento no regex (o Overpass não normaliza). */
function palavraDoNicho(nicho: string) {
  const ignorar = new Set(["de", "da", "do", "das", "dos", "e", "em", "para", "clinica", "clínica", "studio", "estudio", "espaço", "espaco", "centro"]);
  const palavras = nicho.toLowerCase().split(/\s+/).filter((p) => p.length > 3 && !ignorar.has(p));
  const principal = palavras[0] ?? nicho.toLowerCase();
  return principal.replace(/[^a-zà-ú0-9]/g, "").replace(/[aáàâã]/g, "[aáàâã]").replace(/[eéê]/g, "[eéê]")
    .replace(/[ií]/g, "[ií]").replace(/[oóôõ]/g, "[oóôõ]").replace(/[uú]/g, "[uú]").replace(/[cç]/g, "[cç]");
}

export function filtrosDoNicho(nicho: string): string[] {
  const achados = MARCACOES.filter((m) => m.termos.test(nicho));
  const especificos = achados.filter((m) => !m.generico);
  const conhecidos = (especificos.length ? especificos : achados).flatMap((m) => m.filtros);
  // Sempre busca também pelo nome, mas só entre pontos que já são comércio ou
  // serviço: varrer todo nome da cidade estoura o tempo do servidor público.
  const nome = palavraDoNicho(nicho);
  const porNome = ["amenity", "shop", "office", "healthcare"].map((k) => `node["${k}"]["name"~"${nome}",i]`);
  return [...new Set([...conhecidos.map((f) => `nwr${f}`), ...porNome])];
}

type ElementoOsm = {
  type: "node" | "way" | "relation";
  id: number;
  tags?: Record<string, string>;
};

/**
 * Quem não contrata gestor de tráfego: serviço público (posto de saúde, UBS,
 * hospital público, órgãos) e redes grandes (marcadas com "brand" no mapa).
 */
const PUBLICO = /\b(UBS|U\.B\.S|posto de sa[úu]de|centro de sa[úu]de|unidade b[áa]sica|pronto[- ]socorro|pronto atendimento|UPA|hospital|prefeitura|secretaria|CAPS|policl[íi]nica municipal|SUS|universidade|faculdade|escola estadual|escola municipal)\b/i;

export function foraDoPerfil(t: Record<string, string>): boolean {
  if (PUBLICO.test(t.name ?? "")) return true;
  if (/^(public|government|community)$/i.test(t["operator:type"] ?? "")) return true;
  if (/^(public|government|municipal|state)$/i.test(t.ownership ?? "")) return true;
  if (t["healthcare:funding"] === "public") return true;
  if (t.brand || t["brand:wikidata"]) return true;
  return false;
}

/** Elementos do Overpass → empresas no mesmo formato da busca do Google. */
export function converterOsm(elementos: ElementoOsm[], cidade: string): EmpresaGoogle[] {
  const vistos = new Set<string>();
  const empresas: EmpresaGoogle[] = [];
  for (const e of elementos) {
    const t = e.tags ?? {};
    if (!t.name || foraDoPerfil(t)) continue;
    const chave = t.name.toLowerCase().trim();
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    const telefone = t["contact:whatsapp"] ?? t.phone ?? t["contact:phone"] ?? t["contact:mobile"] ?? null;
    let site = t.website ?? t["contact:website"] ?? t.url ?? null;
    if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`;
    const instagram =
      t["contact:instagram"]?.replace(/^.*instagram\.com\//i, "").replace(/[/@?].*$/, "").replace(/^@/, "") ?? null;
    const endereco = [
      [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", "),
      t["addr:suburb"],
      t["addr:city"] ?? cidade,
    ]
      .filter(Boolean)
      .join(" - ");

    empresas.push({
      placeId: `osm:${e.type}/${e.id}`,
      nome: t.name,
      categoria: null,
      telefone: telefone?.split(";")[0].trim() ?? null,
      // Instagram cadastrado como site vira Instagram; a análise trata como "sem site".
      site: site ?? (instagram ? `https://instagram.com/${instagram}` : null),
      endereco: endereco || null,
      // Link do Google Maps pela busca do nome: abre direto na empresa, na maioria das vezes.
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${t.name} ${cidade}`)}`,
      nota: null,
      avaliacoes: null,
    });
  }
  // Quem tem telefone e site primeiro: é quem dá para abordar e analisar.
  const peso = (x: EmpresaGoogle) => (x.telefone ? 2 : 0) + (x.site ? 1 : 0);
  return empresas.sort((a, b) => peso(b) - peso(a));
}

async function acharCidade(cidade: string): Promise<number | null> {
  const params = new URLSearchParams({
    q: /brasil|brazil/i.test(cidade) ? cidade : `${cidade}, Brasil`,
    format: "json",
    limit: "5",
    countrycodes: "br",
  });
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": AGENTE, "Accept-Language": "pt-BR" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) return null;
  const lista = (await r.json()) as { osm_type: string; osm_id: number; addresstype?: string; type?: string }[];
  // A cidade (ou o bairro, se pedido) como área: só "relation" vira área no Overpass.
  const area = lista.find((l) => l.osm_type === "relation");
  return area ? 3_600_000_000 + area.osm_id : null;
}

export async function buscarNoOsm(
  nicho: string,
  cidade: string,
  quantidade: number,
): Promise<{ empresas: EmpresaGoogle[] } | { erro: string }> {
  try {
    const area = await acharCidade(cidade);
    if (!area) return { erro: `Não encontrei "${cidade}" no mapa. Tente só o nome da cidade e o estado, ex.: Campinas, SP.` };

    const consultas = filtrosDoNicho(nicho).map((f) => `${f}(area.a);`).join("\n  ");
    const consulta = `[out:json][timeout:45];\narea(${area})->.a;\n(\n  ${consultas}\n);\nout tags;`;

    // Servidores públicos do mesmo mapa: se um estiver cheio, tenta o próximo.
    let ultimoStatus = 0;
    for (const servidor of SERVIDORES) {
      try {
        const r = await fetch(servidor, {
          method: "POST",
          headers: { "User-Agent": AGENTE, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ data: consulta }),
          cache: "no-store",
          signal: AbortSignal.timeout(55000),
        });
        ultimoStatus = r.status;
        if (!r.ok) continue;
        const json = (await r.json()) as { elements: ElementoOsm[] };
        return { empresas: converterOsm(json.elements, cidade).slice(0, quantidade) };
      } catch {
        // Tempo esgotado neste servidor: segue para o próximo.
      }
    }
    return {
      erro: `O mapa aberto está sobrecarregado agora${ultimoStatus ? ` (${ultimoStatus})` : ""}. Tente de novo em alguns minutos, ou use Colar lista.`,
    };
  } catch (erro) {
    return { erro: `Falha ao consultar o mapa aberto: ${String(erro).slice(0, 120)}` };
  }
}
