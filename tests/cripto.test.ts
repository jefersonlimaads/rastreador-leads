import { describe, expect, it } from "vitest";
import "dotenv/config";
import { cifrar, decifrar, mascarar } from "../src/lib/cripto";

describe("criptografia dos tokens", () => {
  it("cifra e decifra de volta, e o banco não guarda o token em texto", () => {
    const token = "EAAGm0PX4ZCpsBAKZCtoken-de-exemplo-123456";
    const guardado = cifrar(token);
    expect(guardado.startsWith("v1:")).toBe(true);
    expect(guardado).not.toContain("token-de-exemplo");
    expect(decifrar(guardado)).toBe(token);
  });

  it("o mesmo token cifrado duas vezes dá resultados diferentes", () => {
    expect(cifrar("abc")).not.toBe(cifrar("abc"));
  });

  it("adulterar o valor guardado é detectado", () => {
    const guardado = cifrar("token-original");
    const bytes = Buffer.from(guardado.slice(3), "base64");
    bytes[bytes.length - 1] ^= 1;
    expect(() => decifrar("v1:" + bytes.toString("base64"))).toThrow();
  });

  it("token antigo, em texto, continua funcionando até ser salvo de novo", () => {
    expect(decifrar("token-legado")).toBe("token-legado");
  });

  it("máscara mostra só o fim", () => {
    expect(mascarar(cifrar("EAAG1234567890abcd"))).toBe("••••abcd");
  });
});
