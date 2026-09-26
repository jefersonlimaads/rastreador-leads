/**
 * Lead que chega de fora, e os três níveis de origem.
 * Dizer que um lead veio de um anúncio não é a mesma coisa que ter capturado
 * o clique — e é sobre essa diferença que se decide onde colocar verba.
 */
import { describe, expect, it } from "vitest";
import { validarLeads } from "../src/lib/lead-externo";

const base = { clienteId: "c1", telefone: "(11) 98888-7777" };

describe("validação do lead externo", () => {
  it("normaliza o telefone e aceita o mínimo", () => {
    const { aceitos, recusados } = validarLeads([base]);
    expect(recusados).toHaveLength(0);
    expect(aceitos[0].telefone).toBe("5511988887777");
    expect(aceitos[0].mensagem).toBe("Recebido por integração");
    expect(aceitos[0].temOrigem).toBe(false);
  });

  it("recusa telefone inválido e repetido no mesmo envio", () => {
    const { aceitos, recusados } = validarLeads([
      base,
      { ...base },
      { clienteId: "c1", telefone: "123" },
    ]);
    expect(aceitos).toHaveLength(1);
    expect(recusados.map((r) => r.erro)).toEqual([
      "telefone repetido neste envio",
      "telefone inválido",
    ]);
  });

  it("o mesmo telefone em clientes diferentes não é repetição", () => {
    const { aceitos } = validarLeads([base, { ...base, clienteId: "c2" }]);
    expect(aceitos).toHaveLength(2);
  });

  it("reconhece que veio origem no envio", () => {
    const { aceitos } = validarLeads([{ ...base, adId: "120250", utmCampaign: "[LEADS] SP" }]);
    expect(aceitos[0].temOrigem).toBe(true);
    expect(aceitos[0].origem.adId).toBe("120250");
  });

  it("data do envio é usada, mas relógio errado não passa", () => {
    const ontem = new Date(Date.now() - 864e5).toISOString();
    expect(validarLeads([{ ...base, quandoChegou: ontem }]).aceitos[0].mensagemEm.toISOString()).toBe(ontem);

    // Futuro vira agora: relógio adiantado do outro lado é comum.
    const futuro = new Date(Date.now() + 10 * 864e5).toISOString();
    const lido = validarLeads([{ ...base, quandoChegou: futuro }]).aceitos[0];
    expect(lido.mensagemEm.getTime()).toBeLessThanOrEqual(Date.now() + 1000);

    // Texto que não é data também.
    expect(validarLeads([{ ...base, quandoChegou: "ontem de manhã" }]).aceitos[0].mensagemEm).toBeInstanceOf(Date);
  });

  it("campos extras do formulário são limpos pela mesma regra do script", () => {
    const { aceitos } = validarLeads([
      { ...base, campos: [{ rotulo: "Empresa ", valor: " Forte Telecom" }, { rotulo: "Nome", valor: "Ana" }] },
    ]);
    // "Nome" já tem lugar próprio e não vira campo extra.
    expect(aceitos[0].campos).toEqual([{ rotulo: "Empresa", valor: "Forte Telecom" }]);
  });

  it("lixo não derruba o lote: recusa a linha e segue", () => {
    const { aceitos, recusados } = validarLeads([base, null, "texto", { clienteId: "c1" }]);
    expect(aceitos).toHaveLength(1);
    expect(recusados).toHaveLength(3);
    expect(recusados[2].erro).toMatch(/telefone/);
  });
});
