/**
 * Testes das regras que o painel depende para não mentir número.
 * Rodam sem banco: são as funções puras de código, telefone e métricas.
 *
 *   npm test
 */
import { describe, expect, it } from "vitest";
import { extrairCodigo, gerarCodigo, normalizarCodigo } from "../src/lib/codigo";
import { formatarTelefone, linkWhatsapp, normalizarTelefone, hashSha256 } from "../src/lib/telefone";
import { normalizarContaAnuncios } from "../src/lib/telefone";

describe("código do clique", () => {
  it("gera código com 5 caracteres, sem caracteres ambíguos", () => {
    for (let i = 0; i < 200; i++) {
      const codigo = gerarCodigo();
      expect(codigo).toHaveLength(5);
      expect(codigo).toMatch(/^[ACDEFGHJKMNPQRTUVWXY34679]+$/);
      // 0/O, 1/I/L, 2/Z, 5/S e 8/B se confundem quando alguém digita à mão.
      expect(codigo).not.toMatch(/[01ILOZS8B]/);
    }
  });

  it("acha o código entre colchetes na mensagem colada", () => {
    const mensagem = "Olá, vim pelo site e quero saber sobre reforma de cozinha. [NF4T9]";
    expect(extrairCodigo(mensagem)).toBe("NF4T9");
  });

  it("acha o código mesmo se a pessoa apagar os colchetes", () => {
    expect(extrairCodigo("oi, vim pelo site NF4T9")).toBe("NF4T9");
  });

  it("não inventa código quando a mensagem não tem nenhum", () => {
    expect(extrairCodigo("Oi, bom dia! Quanto custa?")).toBeNull();
  });

  it("normaliza o que o atendente digita", () => {
    expect(normalizarCodigo(" nf4t9 ")).toBe("NF4T9");
    expect(normalizarCodigo("[NF4T9]")).toBe("NF4T9");
  });
});

describe("telefone", () => {
  it("põe o 55 na frente de número com DDD", () => {
    expect(normalizarTelefone("(11) 98888-7777")).toBe("5511988887777");
    expect(normalizarTelefone("11 3333-4444")).toBe("551133334444");
  });

  it("mantém número que já vem com código do país", () => {
    expect(normalizarTelefone("+55 11 98888-7777")).toBe("5511988887777");
    expect(normalizarTelefone("5511988887777")).toBe("5511988887777");
  });

  it("recusa o que não é telefone", () => {
    expect(normalizarTelefone("abc")).toBeNull();
    expect(normalizarTelefone("123")).toBeNull();
  });

  it("formata para leitura e monta o link do WhatsApp", () => {
    expect(formatarTelefone("5511988887777")).toBe("(11) 98888-7777");
    expect(linkWhatsapp("5511988887777")).toBe("https://wa.me/5511988887777");
  });

  it("gera o hash que o Meta espera para o telefone", async () => {
    // SHA-256 de "5511988887777", que é o formato exigido pela API de Conversões.
    const hash = await hashSha256("5511988887777");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
    expect(await hashSha256(" 5511988887777 ")).toBe(hash);
  });
});


describe("conta de anúncios", () => {
  it("aceita número puro, com act_, com espaços ou colado do endereço", () => {
    expect(normalizarContaAnuncios("1128897849462370")).toBe("act_1128897849462370");
    expect(normalizarContaAnuncios(" act_1128897849462370 ")).toBe("act_1128897849462370");
    expect(normalizarContaAnuncios("act=1128897849462370&business_id=9")).toBe("act_1128897849462370");
    expect(normalizarContaAnuncios("")).toBeNull();
    expect(normalizarContaAnuncios("abc")).toBeNull();
  });
});
