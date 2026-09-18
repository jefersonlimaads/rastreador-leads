/**
 * O servidor da Vercel roda em UTC e o cliente atende em São Paulo. Estes testes
 * fixam o comportamento nesse cenário, que é onde o erro apareceu: um lead das
 * 18h aparecia como 21h no painel.
 */
import { describe, expect, it } from "vitest";
import {
  formatarData,
  formatarDataHora,
  formatarDataPura,
  formatarMesPuro,
  inicioDoDia,
  fimDoDia,
  periodoPadrao,
  hojeComoDataPura,
  instanteLocal,
  partesLocais,
  dataPuraDe,
} from "../src/lib/datas";

const SP = "America/Sao_Paulo";

describe("datas no fuso do cliente", () => {
  it("mostra a hora de São Paulo, não a do servidor", () => {
    // 17/09/2026 21:09 UTC é 18:09 em São Paulo.
    const instante = new Date("2026-09-17T21:09:00.000Z");
    expect(formatarDataHora(instante, SP)).toBe("17/09/2026, 18:09");
    expect(formatarDataHora(instante, "UTC")).toBe("17/09/2026, 21:09");
  });

  it("vira o dia na meia-noite de São Paulo, não na de Londres", () => {
    // 18/09 00:30 UTC ainda é dia 17 em São Paulo.
    const instante = new Date("2026-09-18T00:30:00.000Z");
    expect(formatarData(instante, SP)).toBe("17/09/2026");
    expect(inicioDoDia(instante, SP).toISOString()).toBe("2026-09-17T03:00:00.000Z");
    expect(fimDoDia(instante, SP).toISOString()).toBe("2026-09-18T02:59:59.999Z");
  });

  it("o período de 7 dias cobre exatamente 7 dias do fuso", () => {
    const { de, ate } = periodoPadrao(7, SP);
    const dias = (ate.getTime() - de.getTime() + 1) / (24 * 60 * 60 * 1000);
    expect(dias).toBe(7);
    // Começa à meia-noite de São Paulo, que em UTC são 3h.
    expect(de.toISOString().slice(11)).toBe("03:00:00.000Z");
  });
});

describe("datas puras: vencimento e competência", () => {
  it("mostra o dia como foi escrito, sem recuar pelo fuso", () => {
    // O banco devolve data pura como meia-noite UTC. Formatar em São Paulo
    // mostrava 09 para um vencimento dia 10.
    const vencimento = new Date("2026-09-10T00:00:00.000Z");
    expect(formatarDataPura(vencimento)).toBe("10/09/2026");
    expect(formatarMesPuro(new Date("2026-09-01T00:00:00.000Z"))).toBe("setembro de 2026");
  });
});

describe("hoje como data pura", () => {
  it("usa o calendário de São Paulo, não o do servidor", () => {
    const hoje = hojeComoDataPura("America/Sao_Paulo");
    const esperado = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
    expect(hoje.toISOString().slice(0, 10)).toBe(esperado);
    expect(hoje.toISOString().slice(11)).toBe("00:00:00.000Z");
  });

  it("soma dias sem escorregar de mês", () => {
    const hoje = hojeComoDataPura("America/Sao_Paulo");
    const amanha = hojeComoDataPura("America/Sao_Paulo", 1);
    expect(amanha.getTime() - hoje.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe("agenda: hora local", () => {
  it("14h em São Paulo é 17h em UTC, e volta como 14h", () => {
    const i = instanteLocal(2026, 9, 18, 14, 30, "America/Sao_Paulo");
    expect(i.toISOString()).toBe("2026-09-18T17:30:00.000Z");
    const p = partesLocais(i, "America/Sao_Paulo");
    expect([p.hora, p.minuto, p.dia]).toEqual([14, 30, 18]);
  });

  it("reunião às 22h em São Paulo cai no mesmo dia, não no seguinte", () => {
    // Em UTC já é 01h do dia 19: a agenda não pode jogar para o dia seguinte.
    const i = instanteLocal(2026, 9, 18, 22, 0, "America/Sao_Paulo");
    expect(dataPuraDe(i, "America/Sao_Paulo").toISOString().slice(0, 10)).toBe("2026-09-18");
  });
});
