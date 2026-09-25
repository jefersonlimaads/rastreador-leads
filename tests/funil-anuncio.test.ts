/**
 * Funil por anúncio: em que etapa o dinheiro está sendo perdido.
 * Funções puras, sem banco.
 */
import { describe, expect, it } from "vitest";
import { funilDoAnuncio } from "../src/lib/funil-anuncio";
import type { AnuncioPeriodo } from "../src/lib/inteligencia";

const anuncio = (p: Partial<AnuncioPeriodo>): AnuncioPeriodo => ({
  adId: "a",
  nome: "Anúncio",
  campanha: "Campanha",
  tipo: "leads_site",
  gasto: 500,
  impressoes: 50000,
  cliquesLink: 1000,
  resultados: 50,
  visitas: 900,
  contatosPainel: 90,
  fechados: 20,
  receita: 20000,
  ...p,
});

describe("funil do anúncio", () => {
  it("aponta o criativo quando ninguém clica", () => {
    // 50.000 impressões, 150 cliques: 0,3%, abaixo do mínimo.
    const f = funilDoAnuncio(anuncio({ cliquesLink: 150, visitas: 140, contatosPainel: 20 }), true);
    expect(f.gargalo?.chave).toBe("cliques");
    expect(f.gargalo?.titulo).toMatch(/criativo/i);
    expect(f.gargalo?.acao).toMatch(/peça|ângulo/i);
  });

  it("aponta o caminho quando o clique não vira visita", () => {
    // Clica bem, mas metade não chega: página lenta ou rastreio quebrado.
    const f = funilDoAnuncio(anuncio({ visitas: 300 }), true);
    expect(f.gargalo?.chave).toBe("visitas");
    expect(f.gargalo?.acao).toMatch(/velocidade|redirecionamento|script/i);
  });

  it("aponta a página quando a visita não vira contato", () => {
    const f = funilDoAnuncio(anuncio({ contatosPainel: 9, fechados: 0 }), true);
    expect(f.gargalo?.chave).toBe("contatos");
    expect(f.gargalo?.acao).toMatch(/página/i);
  });

  it("aponta o atendimento quando o contato não vira venda", () => {
    const f = funilDoAnuncio(anuncio({ fechados: 2 }), true);
    expect(f.gargalo?.chave).toBe("vendas");
    expect(f.gargalo?.acao).toMatch(/atendimento/i);
  });

  it("resolve primeiro o que vem antes no caminho", () => {
    // Criativo ruim e página ruim ao mesmo tempo: primeiro o criativo.
    const f = funilDoAnuncio(anuncio({ cliquesLink: 100, visitas: 95, contatosPainel: 1 }), true);
    expect(f.gargalo?.chave).toBe("cliques");
  });

  it("campanha de conversa não tem etapa de página", () => {
    const f = funilDoAnuncio(anuncio({ tipo: "conversas" }), true);
    expect(f.etapas.map((e) => e.chave)).toEqual(["impressoes", "cliques", "contatos", "vendas"]);
    expect(f.etapas.find((e) => e.chave === "contatos")?.mede).toMatch(/conversa/i);
  });

  it("sem script no ar, a página não é julgada", () => {
    const f = funilDoAnuncio(anuncio({ visitas: 0, contatosPainel: 0 }), false);
    expect(f.etapas.some((e) => e.chave === "visitas")).toBe(false);
  });

  it("volume baixo não vira diagnóstico", () => {
    const f = funilDoAnuncio(
      anuncio({ impressoes: 200, cliquesLink: 1, visitas: 0, contatosPainel: 0, fechados: 0 }),
      true,
    );
    expect(f.etapas.find((e) => e.chave === "cliques")?.estado).toBe("sem_volume");
    expect(f.gargalo).toBeNull();
  });

  it("tudo saudável não inventa gargalo", () => {
    expect(funilDoAnuncio(anuncio({}), true).gargalo).toBeNull();
  });
});
