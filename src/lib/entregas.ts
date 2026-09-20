/**
 * Tipos de entrega da agência. Lista curta de propósito: o que o cliente
 * reconhece como trabalho feito, sem virar formulário de preenchimento.
 *
 * Fica fora das ações porque um arquivo "use server" só exporta função.
 */
export const TIPOS_DE_ENTREGA = [
  "Criativo",
  "Campanha",
  "Otimização",
  "Reunião",
  "Relatório",
  "Outro",
] as const;

export type TipoEntrega = (typeof TIPOS_DE_ENTREGA)[number];
