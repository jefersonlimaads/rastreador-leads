/** Texto livre da proposta em blocos: lista vira lista, parágrafo vira parágrafo. */
import { describe, expect, it } from "vitest";
import { blocosDeTexto } from "../src/lib/propostas";

describe("blocos de texto", () => {
  it("separa parágrafo de lista com marcador", () => {
    expect(
      blocosDeTexto("Carolina, o que ficou da conversa:\n\n• A agenda enche.\n• Paciente novo não entra.\n\nE agora?"),
    ).toEqual([
      { tipo: "paragrafo", texto: "Carolina, o que ficou da conversa:" },
      { tipo: "lista", itens: ["A agenda enche.", "Paciente novo não entra."] },
      { tipo: "paragrafo", texto: "E agora?" },
    ]);
  });

  it("lista numerada mantém o número, que é a ordem escrita", () => {
    const b = blocosDeTexto("Como funciona:\n1. Entender o cenário.\n2. Fazer a fundação.");
    expect(b[1]).toEqual({ tipo: "lista", itens: ["1. Entender o cenário.", "2. Fazer a fundação."] });
  });

  it("linhas seguidas viram um parágrafo só", () => {
    expect(blocosDeTexto("Prazo de 15 dias úteis,\ncontados da aprovação.")).toEqual([
      { tipo: "paragrafo", texto: "Prazo de 15 dias úteis, contados da aprovação." },
    ]);
  });

  it("texto vazio não vira bloco", () => {
    expect(blocosDeTexto("")).toEqual([]);
    expect(blocosDeTexto("\n\n   \n")).toEqual([]);
  });
});
