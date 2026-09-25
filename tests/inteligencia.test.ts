/**
 * As regras que dizem o que escalar, o que está cansado e o que cortar.
 * Funções puras: rodam sem banco e sem internet.
 */
import { describe, expect, it } from "vitest";
import { custoMedio, rankingPorVenda, recomendar, type AnuncioPeriodo } from "../src/lib/inteligencia";

const anuncio = (p: Partial<AnuncioPeriodo> & { adId: string }): AnuncioPeriodo => ({
  nome: `Anúncio ${p.adId}`,
  campanha: "Campanha A",
  tipo: "conversas",
  gasto: 100,
  impressoes: 10000,
  cliquesLink: 200,
  resultados: 10,
  pedidosContato: 0,
  contatosPainel: 0,
  fechados: 0,
  receita: 0,
  ...p,
});

/** Três anúncios a R$ 10 por resultado: a média da conta fica em R$ 10. */
const base = () => [
  anuncio({ adId: "a" }),
  anuncio({ adId: "b" }),
  anuncio({ adId: "c" }),
];

describe("inteligência das campanhas", () => {
  it("custo médio é a mediana de quem teve resultado", () => {
    expect(custoMedio([anuncio({ adId: "a", gasto: 100, resultados: 10 }), anuncio({ adId: "b", gasto: 300, resultados: 10 })])).toBe(20);
    expect(custoMedio([anuncio({ adId: "a", gasto: 50, resultados: 0 })])).toBeNull();
  });

  it("barato e com volume: escalar", () => {
    const atual = [...base(), anuncio({ adId: "bom", gasto: 100, resultados: 25 })]; // R$ 4
    const { recomendacoes } = recomendar(atual, atual);
    const r = recomendacoes.find((x) => x.adId === "bom");
    expect(r?.categoria).toBe("escalar");
    expect(r?.acao).toMatch(/20% a 30%/);
    // A recomendação carrega os números que a sustentam.
    // O padrão brasileiro usa espaço fixo entre "R$" e o número.
    expect(r?.numeros.some((n) => /R\$\s4,00/.test(n.valor))).toBe(true);
  });

  it("barato mas piorando vira atenção, não escala", () => {
    const antes = [...base(), anuncio({ adId: "bom", gasto: 50, resultados: 25 })]; // R$ 2
    const atual = [...base(), anuncio({ adId: "bom", gasto: 100, resultados: 25 })]; // R$ 4
    const r = recomendar(atual, antes).recomendacoes.find((x) => x.adId === "bom");
    expect(r?.categoria).toBe("atencao");
    expect(r?.titulo).toMatch(/piorando/i);
  });

  it("clique caindo e custo subindo com muita entrega: criativo cansado", () => {
    const antes = [...base(), anuncio({ adId: "velho", impressoes: 20000, cliquesLink: 600, gasto: 100, resultados: 20 })];
    const atual = [...base(), anuncio({ adId: "velho", impressoes: 20000, cliquesLink: 200, gasto: 200, resultados: 10 })];
    const r = recomendar(atual, antes).recomendacoes.find((x) => x.adId === "velho");
    expect(r?.categoria).toBe("cansado");
    expect(r?.motivo).toMatch(/caiu/);
  });

  it("gastou bem acima do custo médio sem nenhum resultado: cortar", () => {
    const atual = [...base(), anuncio({ adId: "ruim", gasto: 80, resultados: 0 })];
    const r = recomendar(atual, atual).recomendacoes.find((x) => x.adId === "ruim");
    expect(r?.categoria).toBe("cortar");
  });

  it("quase o dobro do custo médio: cortar", () => {
    const atual = [...base(), anuncio({ adId: "caro", gasto: 100, resultados: 5 })]; // R$ 20 contra R$ 10
    const r = recomendar(atual, atual).recomendacoes.find((x) => x.adId === "caro");
    expect(r?.categoria).toBe("cortar");
    expect(r?.acao).toMatch(/Pause|reduza/i);
  });

  it("pouco investido não vira recomendação de corte", () => {
    const atual = [...base(), anuncio({ adId: "novo", gasto: 5, resultados: 0, impressoes: 300, cliquesLink: 5 })];
    const r = recomendar(atual, atual).recomendacoes.find((x) => x.adId === "novo");
    expect(r?.categoria).toBe("sem_dados");
  });

  it("vendeu e está saudável: destaque de venda", () => {
    const atual = [...base(), anuncio({ adId: "vendeu", gasto: 100, resultados: 10, fechados: 2, receita: 5000 })];
    const r = recomendar(atual, atual).recomendacoes.find((x) => x.adId === "vendeu");
    expect(r?.categoria).toBe("vendendo");
    expect(r?.numeros.some((n) => n.rotulo === "Receita")).toBe(true);
  });

  it("vendeu mas está caro: o diagnóstico de mídia manda, com a venda citada", () => {
    const atual = [...base(), anuncio({ adId: "vendeu", gasto: 300, resultados: 6, fechados: 2, receita: 5000 })];
    const r = recomendar(atual, atual).recomendacoes.find((x) => x.adId === "vendeu");
    expect(r?.categoria).toBe("cortar");
    expect(r?.motivo).toMatch(/venda/);
    expect(r?.acao).toMatch(/antes de cortar/);
  });

  it("cada tipo tem a sua régua: impressão compara com impressão", () => {
    const atual = [
      ...base(), // conversas a R$ 10 cada
      anuncio({ adId: "barato", tipo: "impressoes", gasto: 50, resultados: 50000, impressoes: 50000 }), // R$ 1,00 por mil
      anuncio({ adId: "caro", tipo: "impressoes", gasto: 300, resultados: 40000, impressoes: 40000 }), // R$ 7,50 por mil
    ];
    const { recomendacoes, tipoMediano } = recomendar(atual, atual);
    const barato = recomendacoes.find((x) => x.adId === "barato");
    const caro = recomendacoes.find((x) => x.adId === "caro");
    expect(barato?.categoria).toBe("escalar");
    // Custo por mil, como no Gerenciador.
    expect(barato?.numeros.some((n) => /R\$\s1,00/.test(n.valor))).toBe(true);
    expect(caro?.categoria).toBe("atencao");
    // Nenhum anúncio de conversa foi afetado pela régua das impressões.
    expect(recomendacoes.filter((x) => ["a", "b", "c"].includes(x.adId))).toHaveLength(0);
    expect(tipoMediano).toBe("impressoes");
  });

  it("tipo com um anúncio só não tem régua de conta", () => {
    const atual = [...base(), anuncio({ adId: "unico", tipo: "compras", gasto: 500, resultados: 1 })];
    const r = recomendar(atual, atual).recomendacoes.find((x) => x.adId === "unico");
    // Sem outro anúncio de compras para comparar, não vira "cortar" por preço.
    expect(r?.categoria).not.toBe("cortar");
  });

  it("alerta quando a campanha inteira encarece", () => {
    const antes = [anuncio({ adId: "a", gasto: 100, resultados: 20 })]; // R$ 5
    const atual = [anuncio({ adId: "a", gasto: 100, resultados: 10 })]; // R$ 10
    const { alertas } = recomendar(atual, antes);
    expect(alertas.some((a) => a.titulo.includes("Custo por resultado subindo"))).toBe(true);
  });

  it("alerta quando um anúncio leva quase todo o orçamento", () => {
    const atual = [
      anuncio({ adId: "a", gasto: 900, resultados: 30 }),
      anuncio({ adId: "b", gasto: 50, resultados: 2 }),
      anuncio({ adId: "c", gasto: 50, resultados: 2 }),
    ];
    expect(recomendar(atual, atual).alertas.some((a) => a.titulo.includes("concentrado"))).toBe(true);
  });

  it("divergência pequena não vira alerta: 2 contra 1 é ruído do dia a dia", () => {
    const atual = [anuncio({ adId: "a", tipo: "leads_site", resultados: 2, contatosPainel: 1 })];
    expect(recomendar(atual, atual).alertas.some((x) => x.titulo.includes("Meta conta mais"))).toBe(false);
  });

  it("alerta quando o Meta conta muito mais do que chega na página", () => {
    const atual = [anuncio({ adId: "a", tipo: "leads_site", resultados: 20, contatosPainel: 5 })];
    const alerta = recomendar(atual, atual).alertas.find((x) => x.titulo.includes("Meta conta mais"));
    expect(alerta).toBeTruthy();
    expect(alerta?.motivo).toContain("20 resultados");
    expect(alerta?.motivo).toContain("5 contatos registrados");
  });

  it("anúncio único do tipo é comparado com ele mesmo", () => {
    const antes = [anuncio({ adId: "so", tipo: "leads_site", gasto: 100, resultados: 20 })]; // R$ 5
    const piorou = [anuncio({ adId: "so", tipo: "leads_site", gasto: 100, resultados: 10 })]; // R$ 10
    const r1 = recomendar(piorou, antes).recomendacoes.find((x) => x.adId === "so");
    expect(r1?.categoria).toBe("atencao");
    expect(r1?.titulo).toBe("Custo subindo");
    expect(r1?.acao).toMatch(/segundo criativo/);

    const melhorou = [anuncio({ adId: "so", tipo: "leads_site", gasto: 100, resultados: 40 })]; // R$ 2,50
    const r2 = recomendar(melhorou, antes).recomendacoes.find((x) => x.adId === "so");
    expect(r2?.categoria).toBe("escalar");
    expect(r2?.titulo).toBe("Melhorando");
  });

  it("campanha de impressões não gera alerta de divergência com a página", () => {
    const atual = [anuncio({ adId: "a", tipo: "impressoes", resultados: 20000, impressoes: 20000, contatosPainel: 5 })];
    expect(recomendar(atual, atual).alertas.some((a) => a.titulo.includes("Meta conta mais"))).toBe(false);
  });
});

describe("ranking por custo por venda", () => {
  it("não existe sem venda marcada no funil", () => {
    expect(rankingPorVenda(base())).toBeNull();
  });

  it("ordena do mais barato por venda, e o que não vendeu fica no fim", () => {
    const r = rankingPorVenda([
      anuncio({ adId: "caro", gasto: 600, contatosPainel: 10, fechados: 2, receita: 4000 }),
      anuncio({ adId: "barato", gasto: 200, contatosPainel: 8, fechados: 4, receita: 6000 }),
      anuncio({ adId: "nada", gasto: 300, contatosPainel: 5, fechados: 0, receita: 0 }),
    ]);
    expect(r).not.toBeNull();
    expect(r!.linhas.map((l) => l.adId)).toEqual(["barato", "caro", "nada"]);
    expect(r!.linhas[0].cac).toBe(50);
    expect(r!.linhas[0].conversao).toBe(0.5);
    expect(r!.linhas[2].cac).toBeNull();
    // R$ 1.100 investidos, 6 vendas, R$ 10.000 de receita.
    expect(r!.cac).toBeCloseTo(1100 / 6);
    expect(r!.roas).toBeCloseTo(10000 / 1100);
    expect(r!.gastoSemVenda).toBe(300);
  });
});
