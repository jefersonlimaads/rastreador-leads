/**
 * Telefone em formato único no banco: só dígitos, com o 55 na frente.
 * O Meta exige esse formato antes do hash SHA-256, senão não reconhece o contato.
 */

export function normalizarTelefone(bruto: string): string | null {
  let digitos = bruto.replace(/\D/g, "");
  if (!digitos) return null;

  // Número colado do WhatsApp às vezes vem com 00 ou +55 na frente.
  digitos = digitos.replace(/^0+/, "");

  if (digitos.length === 10 || digitos.length === 11) {
    // DDD + número, sem o código do país.
    digitos = "55" + digitos;
  }

  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) {
    return digitos;
  }

  // Número de fora do Brasil: aceitamos se tiver tamanho plausível de E.164.
  if (digitos.length >= 8 && digitos.length <= 15) {
    return digitos;
  }

  return null;
}

export function formatarTelefone(e164: string): string {
  if (e164.startsWith("55") && (e164.length === 12 || e164.length === 13)) {
    const ddd = e164.slice(2, 4);
    const resto = e164.slice(4);
    const meio = resto.length === 9 ? resto.slice(0, 5) : resto.slice(0, 4);
    const fim = resto.length === 9 ? resto.slice(5) : resto.slice(4);
    return `(${ddd}) ${meio}-${fim}`;
  }
  return "+" + e164;
}

export function linkWhatsapp(e164: string, texto?: string): string {
  const base = `https://wa.me/${e164}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}

/** Hash exigido pela API de Conversões: SHA-256 do valor normalizado, em hex. */
export async function hashSha256(valor: string): Promise<string> {
  const dados = new TextEncoder().encode(valor.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
