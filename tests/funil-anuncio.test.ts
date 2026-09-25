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
  cliquesSaida: 1000,
  resultados: 50,
  visualizacoesPagina: 800,
  conversasIniciadas: 0,
  pedidosContato: 90,
  contatosPainel: 90,
  fechados: 20,
  receita: 20000,
  ...p,
});

describe("funil do anúncio", () => {
  it("aponta o criativo quando ninguém clica", () => {
    // 50.000 impressões, 150 cliques: 0,3%, abaixo do mínimo.
    const f = funilDoAnuncio(anuncio({ cliquesLink: 150, pedidosContato: 14, contatosPainel: 20 }), true);
    expect(f.gargalo?.chave).toBe("cliques");
    expect(f.gargalo?.titulo).toMatch(/criativo/i);
    expect(f.gargalo?.acao).toMatch(/peça|ângulo/i);
  });

  it("aponta a página quando o clique não vira pedido", () => {
    // 1.000 cliques e 20 pedidos: 2%, abaixo do mínimo de 3%.
    const f = funilDoAnuncio(anuncio({ pedidosContato: 16, contatosPainel: 16 }), true);
    expect(f.gargalo?.chave).toBe("pedidos");
    expect(f.gargalo?.acao).toMatch(/página|formulário|oferta/i);
  });

  it("visita é a do Meta, pedido é o do script — nunca o mesmo número", () => {
    /* A visita sai de landing_page_view, contada pelo Meta. O pedido sai do
       nosso script, que só dispara na intenção de contato. Tratar um pelo
       outro fazia a tela acusar página lenta onde havia página normal. */
    const f = funilDoAnuncio(anuncio({ visualizacoesPagina: 800, pedidosContato: 90 }), true);
    const visita = f.etapas.find((e) => e.chave === "visitas")!;
    const pedido = f.etapas.find((e) => e.chave === "pedidos")!;
    expect(visita.valor).toBe(800);
    expect(pedido.valor).toBe(90);
    // Pedido é medido sobre a visita, não sobre o clique.
    expect(pedido.taxa).toBeCloseTo(90 / 800);
  });

  it("aponta o caminho quando o clique não abre a página", () => {
    const f = funilDoAnuncio(anuncio({ visualizacoesPagina: 300, pedidosContato: 30 }), true);
    expect(f.gargalo?.chave).toBe("visitas");
    expect(f.gargalo?.acao).toMatch(/velocidade|redirecionamento/i);
  });

  it("aponta o atendimento quando o contato não vira venda", () => {
    const f = funilDoAnuncio(anuncio({ fechados: 2 }), true);
    expect(f.gargalo?.chave).toBe("vendas");
    expect(f.gargalo?.acao).toMatch(/atendimento/i);
  });

  it("resolve primeiro o que vem antes no caminho", () => {
    // Criativo ruim e página ruim ao mesmo tempo: primeiro o criativo.
    const f = funilDoAnuncio(anuncio({ cliquesLink: 100, pedidosContato: 1, contatosPainel: 1 }), true);
    expect(f.gargalo?.chave).toBe("cliques");
  });

  it("campanha de conversa não tem etapa de página", () => {
    const f = funilDoAnuncio(anuncio({ tipo: "conversas" }), true);
    expect(f.etapas.map((e) => e.chave)).toEqual(["impressoes", "cliques", "contatos", "vendas"]);
    expect(f.etapas.find((e) => e.chave === "contatos")?.mede).toMatch(/conversa/i);
  });

  it("sem script no ar, a página não é julgada", () => {
    const f = funilDoAnuncio(anuncio({ pedidosContato: 0, contatosPainel: 0 }), false);
    expect(f.etapas.some((e) => e.chave === "pedidos")).toBe(false);
  });

  it("volume baixo não vira diagnóstico", () => {
    const f = funilDoAnuncio(
      anuncio({
        impressoes: 200,
        cliquesLink: 1,
        visualizacoesPagina: 0,
        pedidosContato: 0,
        contatosPainel: 0,
        fechados: 0,
      }),
      true,
    );
    expect(f.etapas.find((e) => e.chave === "cliques")?.estado).toBe("sem_volume");
    expect(f.gargalo).toBeNull();
  });

  it("tudo saudável não inventa gargalo", () => {
    expect(funilDoAnuncio(anuncio({}), true).gargalo).toBeNull();
  });
});
