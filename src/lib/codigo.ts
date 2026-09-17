/**
 * Código curto que atravessa a landing page e volta na primeira mensagem.
 * Escopo: 4 a 6 caracteres, sem caracteres ambíguos, porque é lido e digitado à mão.
 */

// Sem 0/O, 1/I/L, 2/Z, 5/S, 8/B — o que sobra não se confunde numa leitura rápida.
const ALFABETO = "ACDEFGHJKMNPQRTUVWXY34679";
const TAMANHO = 5;

export function gerarCodigo(): string {
  const bytes = new Uint8Array(TAMANHO);
  crypto.getRandomValues(bytes);
  let codigo = "";
  for (const b of bytes) {
    codigo += ALFABETO[b % ALFABETO.length];
  }
  return codigo;
}

export function normalizarCodigo(bruto: string): string {
  return bruto.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Procura o código na mensagem colada pelo atendente. O script põe o código
 * entre colchetes, mas gente edita mensagem, então também aceitamos solto.
 */
export function extrairCodigo(mensagem: string): string | null {
  const entreColchetes = mensagem.match(/\[([A-Za-z0-9]{4,6})\]/);
  if (entreColchetes) {
    return normalizarCodigo(entreColchetes[1]);
  }

  const candidatos = mensagem
    .toUpperCase()
    .match(/\b[ACDEFGHJKMNPQRTUVWXY34679]{4,6}\b/g);
  if (!candidatos) return null;

  // Palavra comum do português não usa só esse alfabeto, mas por garantia
  // ficamos com o último candidato: o código vem no fim da mensagem.
  return candidatos[candidatos.length - 1];
}
