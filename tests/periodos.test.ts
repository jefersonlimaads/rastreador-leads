/**
 * Os períodos da tela e o anterior comparável de cada um.
 * TZ=UTC nos testes; o fuso do cliente é passado de propósito.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { resolverPeriodo, lerChave } from "../src/lib/periodos";

const SP = "America/Sao_Paulo";
const dia = (d: Date) => d.toISOString().slice(0, 16);

/** Congela o relógio numa terça, 15 de setembro de 2026, 14h em São Paulo. */
function congelar(iso = "2026-09-15T17:00:00Z") {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

afterEach(() => vi.useRealTimers());

describe("períodos", () => {
  it("hoje começa à meia-noite do fuso do cliente, não em UTC", () => {
    congelar();
    const p = resolverPeriodo("hoje", SP);
    // Meia-noite em São Paulo (UTC-3) é 03:00 UTC.
    expect(dia(p.de)).toBe("2026-09-15T03:00");
    expect(dia(p.anterior.de)).toBe("2026-09-14T03:00");
  });

  it("ontem é um dia inteiro, e o anterior é anteontem", () => {
    congelar();
    const p = resolverPeriodo("ontem", SP);
    expect(dia(p.de)).toBe("2026-09-14T03:00");
    expect(dia(p.anterior.de)).toBe("2026-09-13T03:00");
  });

  it("7 dias inclui hoje e compara com os 7 imediatamente antes", () => {
    congelar();
    const p = resolverPeriodo("7dias", SP);
    expect(dia(p.de)).toBe("2026-09-09T03:00");
    expect(dia(p.anterior.de)).toBe("2026-09-02T03:00");
    // Sem buraco nem sobreposição entre os dois recortes.
    expect(p.anterior.ate.getTime()).toBeLessThan(p.de.getTime());
    expect(p.de.getTime() - p.anterior.ate.getTime()).toBeLessThan(2000);
  });

  it("este mês vai do dia 1 até hoje, não até o fim do mês", () => {
    congelar();
    const p = resolverPeriodo("este_mes", SP);
    expect(dia(p.de)).toBe("2026-09-01T03:00");
    expect(p.ate.getUTCDate()).toBe(16); // fim do dia 15 em SP = 16 às 02:59 UTC
    // Compara com o mesmo pedaço do mês passado, não com agosto inteiro.
    expect(dia(p.anterior.de)).toBe("2026-08-01T03:00");
    const tamanho = (x: { de: Date; ate: Date }) => x.ate.getTime() - x.de.getTime();
    expect(tamanho(p.anterior)).toBeLessThanOrEqual(tamanho(p));
  });

  it("mês anterior é o mês fechado, e compara com o de dois meses atrás", () => {
    congelar();
    const p = resolverPeriodo("mes_anterior", SP);
    expect(dia(p.de)).toBe("2026-08-01T03:00");
    expect(dia(p.anterior.de)).toBe("2026-07-01T03:00");
  });

  it("vira o ano sem quebrar", () => {
    congelar("2026-01-10T17:00:00Z");
    const p = resolverPeriodo("mes_anterior", SP);
    expect(dia(p.de)).toBe("2025-12-01T03:00");
    expect(dia(p.anterior.de)).toBe("2025-11-01T03:00");
  });

  it("personalizado aceita o intervalo e recusa o que não serve", () => {
    congelar();
    const bom = resolverPeriodo("personalizado", SP, { de: "2026-09-01", ate: "2026-09-10" });
    expect(dia(bom.de)).toBe("2026-09-01T03:00");
    expect(bom.ate.getUTCDate()).toBe(11);

    // Fim antes do começo cai no padrão de 30 dias.
    const invertido = resolverPeriodo("personalizado", SP, { de: "2026-09-10", ate: "2026-09-01" });
    expect(dia(invertido.de)).toBe("2026-08-17T03:00");

    // Mais de um ano também.
    const gigante = resolverPeriodo("personalizado", SP, { de: "2020-01-01", ate: "2026-09-01" });
    expect(dia(gigante.de)).toBe("2026-08-17T03:00");
  });

  it("chave desconhecida da URL cai em 30 dias", () => {
    expect(lerChave("mes_anterior")).toBe("mes_anterior");
    expect(lerChave("qualquer-coisa")).toBe("30dias");
    expect(lerChave(undefined)).toBe("30dias");
  });
});
