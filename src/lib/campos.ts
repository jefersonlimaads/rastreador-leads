/**
 * Campos do formulário da landing page.
 *
 * O que a pessoa respondeu além de nome e telefone: empresa, evento, data,
 * cidade, o que aquele cliente perguntar. Sem isso, quem atende recebe uma
 * lista de telefones e não faz ideia de quem é quem — que é exatamente a
 * reclamação que fez isso existir.
 *
 * Fica aqui, em função pura, porque entra por uma rota pública: o que vem de
 * fora é sempre suspeito, e a regra de corte precisa ser testável sem banco.
 */

export type CampoFormulario = { rotulo: string; valor: string };

/** Limites de sanidade: formulário honesto não passa disso. */
export const MAX_CAMPOS = 12;
const MAX_ROTULO = 60;
const MAX_VALOR = 300;

/** Campos que já têm lugar próprio, ou que não são resposta de ninguém. */
const IGNORAR = /^(nome|name|telefone|whatsapp|whats|celular|phone|tel|e-?mail|email)$/i;

/**
 * Campo de data chega como "2026-11-12", que é o formato do input e não o que
 * ninguém lê. Vira 12/11/2026 sem virar objeto Date: é texto que a pessoa
 * digitou, não instante no tempo, e converter traria fuso para uma conta que
 * não precisa dele.
 */
const comoSeLe = (valor: string) => {
  const iso = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : valor;
};

const limpar = (texto: string) =>
  texto
    .replace(/\s+/g, " ")
    .replace(/\s*\*\s*$/, "")
    .replace(/\s*:\s*$/, "")
    .trim();

/**
 * Normaliza o que a página mandou. Descarta vazio, corta o que é longo demais
 * e mantém a ordem em que a pessoa respondeu — é a ordem do formulário, que é
 * a que faz sentido para quem lê.
 */
export function lerCampos(bruto: unknown): CampoFormulario[] {
  if (!Array.isArray(bruto)) return [];

  const vistos = new Set<string>();
  const saida: CampoFormulario[] = [];

  for (const item of bruto) {
    if (typeof item !== "object" || item === null) continue;
    const r = (item as Record<string, unknown>).rotulo;
    const v = (item as Record<string, unknown>).valor;
    if (typeof r !== "string" || typeof v !== "string") continue;

    const rotulo = limpar(r).slice(0, MAX_ROTULO);
    const valor = comoSeLe(limpar(v)).slice(0, MAX_VALOR);
    if (!rotulo || !valor) continue;
    if (IGNORAR.test(rotulo)) continue;

    // Dois campos com o mesmo rótulo: fica o primeiro.
    const chave = rotulo.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    saida.push({ rotulo, valor });
    if (saida.length >= MAX_CAMPOS) break;
  }

  return saida;
}

/** Uma linha só, para caber em card e em mensagem: "Empresa: X · Evento: Y". */
export function resumoDosCampos(campos: CampoFormulario[], quantos = 3): string {
  return campos
    .slice(0, quantos)
    .map((c) => `${c.rotulo}: ${c.valor}`)
    .join(" · ");
}
