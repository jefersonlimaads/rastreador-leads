/**
 * Números das regras de negócio do escopo, num lugar só.
 * Mudar aqui muda o sistema inteiro; mudar espalhado no código é como se perde.
 */
export const REGRAS = {
  /** Regra 2: janela para sugerir clique quando a mensagem veio sem código. */
  janelaAtribuicaoMin: 30,
  /** Regra 5: lead fechado ou perdido há mais que isso vira oportunidade nova. */
  reabrirLeadDias: 60,
  /** Regra 8: lead em "novo" há mais que isso aparece destacado na fila do dia. */
  destaqueNovoHoras: 2,
  /** Regra 9: lead sem evento há mais que isso entra na fila de follow-up. */
  followUpDias: 3,
  /** Regra 12: clique pendente há mais que isso vira clique sem contato. */
  cliqueSemContatoHoras: 24,
} as const;

export const STATUS_ABERTOS = [
  "NOVO",
  "EM_ATENDIMENTO",
  "PROPOSTA_ENVIADA",
  "NEGOCIANDO",
] as const;

/** Ordem do funil, do primeiro contato ao desfecho. Vale para o painel inteiro. */
export const ETAPAS = [
  "NOVO",
  "EM_ATENDIMENTO",
  "PROPOSTA_ENVIADA",
  "NEGOCIANDO",
  "FECHADO",
  "PERDIDO",
] as const;

/** As que o cliente escolhe quando diz que o lead ainda está sendo tratado. */
export const ETAPAS_EM_ANDAMENTO = ["EM_ATENDIMENTO", "PROPOSTA_ENVIADA", "NEGOCIANDO"] as const;

/**
 * Que etapas do meio cada tipo de funil usa.
 *
 * Clínica e psicóloga atendem e fecham: mostrar "proposta enviada" para elas é
 * ruído na tela de quem responde. Filmmaker, obra e consultoria passam pelas
 * três. Os dois são recortes da mesma lista, então a Carteira continua
 * comparando clientes entre si.
 */
export const ETAPAS_DO_FUNIL = {
  SIMPLES: ["EM_ATENDIMENTO"],
  COMPLETO: ["EM_ATENDIMENTO", "PROPOSTA_ENVIADA", "NEGOCIANDO"],
} as const;

export const ROTULO_FUNIL: Record<string, string> = {
  SIMPLES: "Simples — atende e fecha",
  COMPLETO: "Completo — com proposta e negociação",
};

/** Colunas do pipeline de um cliente: as do funil dele, mais as que têm lead. */
export function etapasVisiveis(funil: string, comLeads: string[] = []): string[] {
  const doFunil = ETAPAS_DO_FUNIL[funil as keyof typeof ETAPAS_DO_FUNIL] ?? ETAPAS_DO_FUNIL.COMPLETO;
  return ETAPAS.filter(
    (e) =>
      e === "NOVO" ||
      e === "FECHADO" ||
      e === "PERDIDO" ||
      (doFunil as readonly string[]).includes(e) ||
      // Etapa fora do funil atual que ainda tem lead: some da escolha, mas
      // continua visível, senão o lead desapareceria do pipeline.
      comLeads.includes(e),
  );
}

export const ROTULO_STATUS: Record<string, string> = {
  NOVO: "Novo",
  EM_ATENDIMENTO: "Em atendimento",
  PROPOSTA_ENVIADA: "Proposta enviada",
  NEGOCIANDO: "Negociando",
  FECHADO: "Fechado",
  PERDIDO: "Perdido",
};

export const ROTULO_ATRIBUICAO: Record<string, string> = {
  EXATA: "Exata",
  PROVAVEL: "Provável",
  DESCONHECIDA: "Desconhecida",
};

export const ROTULO_EVENTO: Record<string, string> = {
  MENSAGEM: "Mensagem recebida",
  MUDANCA_STATUS: "Mudança de status",
  CONTATO: "Contato registrado",
  FOLLOW_UP: "Follow-up",
  NOTA: "Nota",
  RETORNO: "Retorno do mesmo telefone",
};

export const CICLOS_EM_CARTEIRA = ["ATIVO", "PAUSADO"] as const;
export const CICLOS_EM_PROSPECCAO = ["PROSPECCAO", "PROPOSTA_ENVIADA", "NEGOCIANDO"] as const;

export const ROTULO_CICLO: Record<string, string> = {
  PROSPECCAO: "Prospecção",
  PROPOSTA_ENVIADA: "Proposta enviada",
  NEGOCIANDO: "Negociando",
  ATIVO: "Ativo",
  PAUSADO: "Pausado",
  ENCERRADO: "Encerrado",
};

export const ROTULO_FATURA: Record<string, string> = {
  ABERTA: "Em aberto",
  PAGA: "Paga",
  CANCELADA: "Cancelada",
};
