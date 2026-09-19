/**
 * O "resultado" de cada campanha tem que bater com a coluna Resultados do
 * Gerenciador de Anúncios, senão o cliente compara e desconfia do relatório.
 */
import { describe, expect, it } from "vitest";
import { leadsMeta, resultadosPorCampanha, tipoDoResultado, type LinhaGasto } from "../src/lib/resultados";

const linha = (p: Partial<LinhaGasto>): LinhaGasto => ({
  campaignId: "c1",
  campaignNome: "Campanha",
  otimizacao: null,
  objetivo: null,
  acoes: null,
  valoresAcoes: null,
  cliquesLink: 0,
  impressoes: 0,
  valor: 0,
  ...p,
});

describe("tipo do resultado", () => {
  it("clique para WhatsApp conta conversas iniciadas", () => {
    expect(tipoDoResultado("CONVERSATIONS", "OUTCOME_ENGAGEMENT")).toBe("conversas");
    expect(tipoDoResultado("CONVERSATIONS", "OUTCOME_LEADS")).toBe("conversas");
  });

  it("página com pixel conta o evento que aconteceu", () => {
    expect(tipoDoResultado("OFFSITE_CONVERSIONS", "OUTCOME_LEADS", { "offsite_conversion.fb_pixel_lead": 3 })).toBe("leads_site");
    expect(tipoDoResultado("OFFSITE_CONVERSIONS", "OUTCOME_SALES", {})).toBe("compras");
  });

  it("alcance, vídeo, engajamento e formulário", () => {
    expect(tipoDoResultado("REACH", "OUTCOME_AWARENESS")).toBe("alcance");
    expect(tipoDoResultado("THRUPLAY", "OUTCOME_AWARENESS")).toBe("thruplays");
    expect(tipoDoResultado("POST_ENGAGEMENT", "OUTCOME_ENGAGEMENT")).toBe("engajamentos");
    expect(tipoDoResultado("LEAD_GENERATION", "OUTCOME_LEADS")).toBe("leads_formulario");
  });

  it("sem otimização, o que aconteceu desempata", () => {
    expect(tipoDoResultado(null, null, { "onsite_conversion.messaging_conversation_started_7d": 2 })).toBe("conversas");
    expect(tipoDoResultado(null, null, {})).toBe("cliques_link");
  });
});

describe("leads do Meta", () => {
  it("usa o total quando existe, para não somar duas vezes", () => {
    expect(leadsMeta({ lead: 5, "offsite_conversion.fb_pixel_lead": 5 })).toBe(5);
    expect(leadsMeta({ "offsite_conversion.fb_pixel_lead": 2, "onsite_conversion.lead_grouped": 1 })).toBe(3);
  });
});

describe("resultados por campanha", () => {
  it("soma os dias e calcula o custo por resultado", () => {
    const conv = { "onsite_conversion.messaging_conversation_started_7d": 4 };
    const [c] = resultadosPorCampanha([
      linha({ otimizacao: "CONVERSATIONS", acoes: conv, valor: 20 }),
      linha({ otimizacao: "CONVERSATIONS", acoes: conv, valor: 20 }),
    ]);
    expect(c.tipo).toBe("conversas");
    expect(c.resultados).toBe(8);
    expect(c.gasto).toBe(40);
    expect(c.custoPorResultado).toBe(5);
  });

  it("campanha com dois conjuntos fica com a otimização que mais gastou", () => {
    const [c] = resultadosPorCampanha([
      linha({ otimizacao: "LINK_CLICKS", cliquesLink: 50, valor: 10 }),
      linha({ otimizacao: "CONVERSATIONS", acoes: { "onsite_conversion.messaging_conversation_started_7d": 6 }, valor: 30 }),
    ]);
    expect(c.tipo).toBe("conversas");
    expect(c.resultados).toBe(6);
  });

  it("alcance vem pronto do Meta e custa por mil pessoas", () => {
    const [c] = resultadosPorCampanha(
      [linha({ otimizacao: "REACH", impressoes: 30000, valor: 50 })],
      new Map([["c1", { alcance: 10000, frequencia: 3 }]]),
    );
    expect(c.resultados).toBe(10000);
    expect(c.custoPorResultado).toBe(5);
  });
});

describe("casos de borda", () => {
  it("alcance sem o número do Meta cai para impressões", () => {
    const [c] = resultadosPorCampanha([linha({ otimizacao: "REACH", impressoes: 20000, valor: 40 })]);
    expect(c.tipo).toBe("impressoes");
    expect(c.resultados).toBe(20000);
    expect(c.custoPorResultado).toBe(2);
  });

  it("campanha só com linhas antigas, sem resultado, fica de fora", () => {
    expect(resultadosPorCampanha([linha({ valor: 10 })])).toHaveLength(0);
  });
});
