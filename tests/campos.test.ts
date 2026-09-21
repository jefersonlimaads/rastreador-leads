/**
 * Campos do formulário: o que chega pela rota pública é sempre suspeito.
 * Funções puras, sem banco.
 */
import { describe, expect, it } from "vitest";
import { lerCampos, MAX_CAMPOS, resumoDosCampos } from "../src/lib/campos";

describe("campos do formulário", () => {
  it("mantém a ordem e limpa rótulo e valor", () => {
    expect(
      lerCampos([
        { rotulo: "Empresa ", valor: " Forte Telecom" },
        { rotulo: "Qual o nome do evento? *", valor: "AGC26" },
        { rotulo: "Cidade do evento:", valor: "São  Paulo, SP" },
      ]),
    ).toEqual([
      { rotulo: "Empresa", valor: "Forte Telecom" },
      { rotulo: "Qual o nome do evento?", valor: "AGC26" },
      { rotulo: "Cidade do evento", valor: "São Paulo, SP" },
    ]);
  });

  it("descarta vazio, repetido e o que já tem lugar próprio", () => {
    expect(
      lerCampos([
        { rotulo: "Nome", valor: "Ana" },
        { rotulo: "WhatsApp", valor: "11999999999" },
        { rotulo: "Empresa", valor: "" },
        { rotulo: "Evento", valor: "Futurecom" },
        { rotulo: "evento", valor: "Outro" },
      ]),
    ).toEqual([{ rotulo: "Evento", valor: "Futurecom" }]);
  });

  it("não aceita lixo nem lista sem fim", () => {
    expect(lerCampos(null)).toEqual([]);
    expect(lerCampos("empresa")).toEqual([]);
    expect(lerCampos([{ rotulo: 1, valor: 2 }, "x", null])).toEqual([]);

    const muitos = Array.from({ length: 40 }, (_, i) => ({ rotulo: `Campo ${i}`, valor: "x" }));
    expect(lerCampos(muitos)).toHaveLength(MAX_CAMPOS);

    const [longo] = lerCampos([{ rotulo: "a".repeat(200), valor: "b".repeat(900) }]);
    expect(longo.rotulo).toHaveLength(60);
    expect(longo.valor).toHaveLength(300);
  });

  it("data do formulário sai no formato que se lê", () => {
    expect(lerCampos([{ rotulo: "Data do evento", valor: "2026-11-12" }])).toEqual([
      { rotulo: "Data do evento", valor: "12/11/2026" },
    ]);
    // Texto que só parece data continua inteiro.
    expect(lerCampos([{ rotulo: "Obs", valor: "de 2026-11-12 a 14" }])[0].valor).toBe(
      "de 2026-11-12 a 14",
    );
  });

  it("resumo cabe em uma linha", () => {
    const campos = lerCampos([
      { rotulo: "Empresa", valor: "Forte Telecom" },
      { rotulo: "Evento", valor: "AGC26" },
      { rotulo: "Cidade", valor: "São Paulo" },
      { rotulo: "Serviço", valor: "Pack de Fotos" },
    ]);
    expect(resumoDosCampos(campos)).toBe("Empresa: Forte Telecom · Evento: AGC26 · Cidade: São Paulo");
  });
});
