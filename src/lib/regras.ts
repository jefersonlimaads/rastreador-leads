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
  "QUALIFICADO",
  "PROPOSTA_ENVIADA",
  "NEGOCIANDO",
] as const;

/** Ordem do funil, do primeiro contato ao desfecho. Vale para o painel inteiro. */
export const ETAPAS = [
  "NOVO",
  "EM_ATENDIMENTO",
  "QUALIFICADO",
  "PROPOSTA_ENVIADA",
  "NEGOCIANDO",
  "FECHADO",
  "PERDIDO",
] as const;

/** As que o cliente escolhe quando diz que o lead ainda está sendo tratado. */
export const ETAPAS_EM_ANDAMENTO = [
  "EM_ATENDIMENTO",
  "QUALIFICADO",
  "PROPOSTA_ENVIADA",
  "NEGOCIANDO",
] as const;

/**
 * Que etapas do meio cada tipo de funil usa.
 *
 * Clínica e psicóloga atendem e fecham: mostrar "proposta enviada" para elas é
 * ruído na tela de quem responde. Filmmaker, obra e consultoria passam pelas
 * três. Os dois são recortes da mesma lista, então a Carteira continua
 * comparando clientes entre si.
 */
export const ETAPAS_DO_FUNIL = {
  SIMPLES: ["EM_ATENDIMENTO", "QUALIFICADO"],
  COMPLETO: ["EM_ATENDIMENTO", "QUALIFICADO", "PROPOSTA_ENVIADA", "NEGOCIANDO"],
} as const;

/**
 * Etapas em que o lead já foi considerado bom para o negócio.
 *
 * Quem fechou passou por qualificado, mesmo que ninguém tenha clicado na
 * etapa. Sem essa lista, a taxa de qualificação cairia toda vez que alguém
 * pulasse direto para o fechamento — punindo o atendimento rápido.
 */
export const ETAPAS_QUALIFICADAS = [
  "QUALIFICADO",
  "PROPOSTA_ENVIADA",
  "NEGOCIANDO",
  "FECHADO",
] as const;

/**
 * Motivos de perda. Lista fechada de propósito: texto livre não se compara
 * entre clientes nem entre campanhas, e é a comparação que diz se o problema
 * está no anúncio, na página ou no atendimento.
 *
 * A observação em texto continua existindo ao lado, para o detalhe.
 */
export const MOTIVOS_PERDA = [
  { chave: "NAO_RESPONDEU", rotulo: "Não respondeu", ondeAponta: "atendimento" },
  { chave: "SEM_INTERESSE", rotulo: "Sem interesse", ondeAponta: "anuncio" },
  { chave: "SEM_ORCAMENTO", rotulo: "Sem orçamento", ondeAponta: "anuncio" },
  { chave: "FORA_DA_REGIAO", rotulo: "Fora da região", ondeAponta: "anuncio" },
  { chave: "PERFIL_INADEQUADO", rotulo: "Perfil inadequado", ondeAponta: "anuncio" },
  { chave: "ESCOLHEU_CONCORRENTE", rotulo: "Escolheu concorrente", ondeAponta: "proposta" },
  { chave: "ATENDIMENTO_DEMORADO", rotulo: "Atendimento demorado", ondeAponta: "atendimento" },
  { chave: "DUPLICADO", rotulo: "Duplicado", ondeAponta: "dado" },
  { chave: "OUTRO", rotulo: "Outro", ondeAponta: "dado" },
] as const;

export const ROTULO_MOTIVO: Record<string, string> = Object.fromEntries(
  MOTIVOS_PERDA.map((m) => [m.chave, m.rotulo]),
);

/**
 * Para onde cada motivo aponta. "Sem interesse" e "fora da região" em volume
 * são problema de segmentação do anúncio; "não respondeu" e "demorou" são do
 * atendimento. É o que transforma motivo de perda em decisão.
 */
export const ONDE_APONTA: Record<string, string> = Object.fromEntries(
  MOTIVOS_PERDA.map((m) => [m.chave, m.ondeAponta]),
);

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
  QUALIFICADO: "Qualificado",
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

/** Funil de prospecção, na ordem. Antes da proposta, você move; depois, a proposta move. */
export const CICLOS_EM_PROSPECCAO = [
  "PROSPECCAO",
  "ABORDADO",
  "RESPONDEU",
  "REUNIAO_MARCADA",
  "PROPOSTA_ENVIADA",
  "NEGOCIANDO",
] as const;

/** Etapas que você move à mão. As outras dependem da proposta. */
export const CICLOS_ANTES_DA_PROPOSTA = [
  "PROSPECCAO",
  "ABORDADO",
  "RESPONDEU",
  "REUNIAO_MARCADA",
] as const;

export const ROTULO_CICLO: Record<string, string> = {
  PROSPECCAO: "A abordar",
  ABORDADO: "Abordado",
  RESPONDEU: "Respondeu",
  REUNIAO_MARCADA: "Reunião marcada",
  PROPOSTA_ENVIADA: "Proposta enviada",
  NEGOCIANDO: "Negociando",
  ATIVO: "Ativo",
  PAUSADO: "Pausado",
  ENCERRADO: "Encerrado",
  PERDIDO: "Perdido",
};

export const ROTULO_INTERACAO: Record<string, string> = {
  MENSAGEM: "Mensagem",
  LIGACAO: "Ligação",
  REUNIAO: "Reunião",
  EMAIL: "E-mail",
  NOTA: "Nota",
};

export const ORIGENS = ["Indicação", "Instagram", "Abordagem fria", "Evento", "Site", "Outro"];

export const ROTULO_FATURA: Record<string, string> = {
  ABERTA: "Em aberto",
  PAGA: "Paga",
  CANCELADA: "Cancelada",
};

/**
 * Parâmetros de URL que vão em todo anúncio do Meta (Rastreamento → Parâmetros
 * de URL). O mesmo texto para qualquer cliente: o que está entre {{ }} o Meta
 * preenche no clique. Os ids são o que liga o lead ao gasto do anúncio.
 */
export const PARAMETROS_URL_META =
  "utm_source=facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{ad.name}}" +
  "&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}";

/**
 * De quanto em quanto tempo uma tarefa volta. Fica aqui, e não nas ações,
 * porque arquivo "use server" só exporta função — e a tela precisa da lista.
 */
export const RECORRENCIAS = [
  { valor: "", rotulo: "Uma vez" },
  { valor: "semanal", rotulo: "Toda semana" },
  { valor: "quinzenal", rotulo: "A cada 15 dias" },
  { valor: "mensal", rotulo: "Todo mês" },
] as const;

export const DIAS_DA_RECORRENCIA: Record<string, number> = {
  semanal: 7,
  quinzenal: 15,
  mensal: 30,
};

/**
 * Quando a próxima ocorrência cai.
 *
 * Conta a partir do prazo da tarefa concluída, não da data em que ela foi
 * feita: senão uma tarefa semanal entregue com três dias de atraso empurraria
 * a série inteira, e em dois meses a "reunião de segunda" estaria na quinta.
 *
 * Sem prazo, não há série a preservar: conta a partir de hoje.
 */
export function proximaOcorrencia(
  prazo: Date | null,
  recorrencia: string | null,
  hoje = new Date(),
): Date | null {
  const dias = DIAS_DA_RECORRENCIA[recorrencia ?? ""];
  if (!dias) return null;

  const base = prazo ?? hoje;
  let proximo = new Date(base.getTime() + dias * 24 * 60 * 60 * 1000);

  /* Tarefa muito atrasada geraria a próxima já vencida, e o painel abriria com
     uma cobrança do passado. Anda até cair no futuro, mantendo o ritmo. */
  while (proximo.getTime() <= hoje.getTime() - 24 * 60 * 60 * 1000) {
    proximo = new Date(proximo.getTime() + dias * 24 * 60 * 60 * 1000);
  }
  return proximo;
}
