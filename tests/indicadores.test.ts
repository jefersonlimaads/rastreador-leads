/**
 * Indicador que sabe o quanto sabe. O erro que isto evita: mostrar zero onde
 * falta dado, que parece medição e é ausência.
 */
import { describe, expect, it } from "vitest";
import {
  custoPorContato,
  custoPorVenda,
  formatar,
  receita,
  roas,
  taxaFechamento,
  taxaQualificacao,
} from "../src/lib/indicadores";

describe("receita e retorno", () => {
  it("venda sem valor lançado torna a receita um piso, não um total", () => {
    const r = receita({ soma: 10000, vendasComValor: 7, vendasTotal: 10 });
    expect(r.estado).toBe("parcial");
    expect(r.valor).toBe(10000);
    expect(r.motivo).toMatch(/3 de 10 vendas sem valor/);

    // O retorno herda a incerteza e diz para que lado ela puxa.
    const x = roas(r, 2000);
    expect(x.estado).toBe("parcial");
    expect(x.valor).toBe(5);
    expect(x.motivo).toMatch(/retorno real é maior/);
  });

  it("sem venda registrada, retorno é indisponível e nunca zero", () => {
    const r = receita({ soma: 0, vendasComValor: 0, vendasTotal: 0 });
    expect(r.estado).toBe("indisponivel");
    expect(r.valor).toBeNull();

    const x = roas(r, 3000);
    expect(x.valor).toBeNull();
    expect(formatar(x, "vezes")).toBe("indisponível");
  });

  it("tudo lançado, número exato", () => {
    const r = receita({ soma: 10000, vendasComValor: 5, vendasTotal: 5 });
    expect(roas(r, 2000)).toMatchObject({ estado: "exato", valor: 5 });
  });
});

describe("custo por contato", () => {
  it("contato sem origem deixa o custo por anúncio como teto", () => {
    const c = custoPorContato({ investimento: 1000, contatos: 50, semOrigem: 12 });
    expect(c.estado).toBe("parcial");
    expect(c.valor).toBe(20);
    expect(c.motivo).toMatch(/custo real é menor/);
  });

  it("sem contato não existe custo por contato", () => {
    expect(custoPorContato({ investimento: 500, contatos: 0, semOrigem: 0 }).valor).toBeNull();
  });
});

describe("taxas", () => {
  it("etapa nunca usada é indisponível, não zero por cento", () => {
    const t = taxaQualificacao({ qualificados: 0, contatos: 40, algumDiaClassificou: false });
    expect(t.estado).toBe("indisponivel");
    expect(t.motivo).toMatch(/ninguém marcou/);
    expect(formatar(t, "pct")).toBe("indisponível");
  });

  it("classificou e deu zero é zero de verdade", () => {
    const t = taxaQualificacao({ qualificados: 0, contatos: 40, algumDiaClassificou: true });
    expect(t).toMatchObject({ estado: "exato", valor: 0 });
  });

  it("contato em aberto deixa o fechamento provisório", () => {
    const t = taxaFechamento({ fechados: 5, contatos: 50, emAberto: 20 });
    expect(t.estado).toBe("parcial");
    expect(t.motivo).toMatch(/deve subir/);
  });

  it("período encerrado dá taxa final", () => {
    expect(taxaFechamento({ fechados: 5, contatos: 50, emAberto: 0 }).estado).toBe("exato");
  });

  it("sem venda não há custo por venda", () => {
    expect(custoPorVenda(1000, 0).estado).toBe("indisponivel");
    expect(custoPorVenda(1000, 4)).toMatchObject({ estado: "exato", valor: 250 });
  });
});
