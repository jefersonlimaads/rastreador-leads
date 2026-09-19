import "server-only";

/**
 * Busca de empresas no Google (Places API, versão nova), oficial e paga por
 * uso. Uma chamada devolve até 20 empresas; a busca pede páginas até chegar à
 * quantidade. Só os campos pedidos no FieldMask são cobrados.
 */

export type EmpresaGoogle = {
  placeId: string;
  nome: string;
  categoria: string | null;
  telefone: string | null;
  site: string | null;
  endereco: string | null;
  mapsUrl: string | null;
  nota: number | null;
  avaliacoes: number | null;
};

const CAMPOS = [
  "places.id",
  "places.displayName",
  "places.primaryTypeDisplayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.businessStatus",
  "nextPageToken",
].join(",");

type Resposta = {
  places?: {
    id: string;
    displayName?: { text: string };
    primaryTypeDisplayName?: { text: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    rating?: number;
    userRatingCount?: number;
    googleMapsUri?: string;
    businessStatus?: string;
  }[];
  nextPageToken?: string;
  error?: { message: string };
};

export function googleConfigurado() {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

export async function buscarNoGoogle(
  consulta: string,
  quantidade: number,
): Promise<{ empresas: EmpresaGoogle[] } | { erro: string }> {
  const chave = process.env.GOOGLE_PLACES_API_KEY;
  if (!chave) return { erro: "Falta a chave GOOGLE_PLACES_API_KEY na Vercel." };

  const empresas: EmpresaGoogle[] = [];
  let pagina: string | undefined;

  // O Google entrega no máximo 60 resultados por consulta (3 páginas de 20).
  for (let i = 0; i < 3 && empresas.length < quantidade; i++) {
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": chave,
        "X-Goog-FieldMask": CAMPOS,
      },
      body: JSON.stringify({
        textQuery: consulta,
        languageCode: "pt-BR",
        regionCode: "BR",
        pageSize: 20,
        ...(pagina ? { pageToken: pagina } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const json = (await r.json()) as Resposta;
    if (!r.ok) return { erro: `Google respondeu ${r.status}: ${json.error?.message ?? "erro desconhecido"}` };

    for (const p of json.places ?? []) {
      // Fechado de vez não é prospect.
      if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;
      empresas.push({
        placeId: p.id,
        nome: p.displayName?.text ?? "Sem nome",
        categoria: p.primaryTypeDisplayName?.text ?? null,
        telefone: p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null,
        site: p.websiteUri ?? null,
        endereco: p.formattedAddress ?? null,
        mapsUrl: p.googleMapsUri ?? null,
        nota: p.rating ?? null,
        avaliacoes: p.userRatingCount ?? null,
      });
    }
    pagina = json.nextPageToken;
    if (!pagina) break;
  }

  return { empresas: empresas.slice(0, quantidade) };
}
