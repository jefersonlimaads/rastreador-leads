/**
 * Quem abriu: gente ou robô. "Proposta aberta" é sinal de venda — se contar
 * robô, a ligação sai errada.
 */
import { describe, expect, it } from "vitest";
import { ehRobo } from "../src/lib/robo";

const CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

describe("robô ou gente", () => {
  it("prévia de link em mensageiro é robô", () => {
    // O caso real: colar o link no WhatsApp faz ele buscar a página sozinho.
    expect(ehRobo("WhatsApp/2.23.20.0 A")).toBe(true);
    expect(ehRobo("WhatsApp/2.2412.54 N")).toBe(true);
    expect(ehRobo("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")).toBe(true);
    expect(ehRobo("TelegramBot (like TwitterBot)")).toBe(true);
    expect(ehRobo("Slackbot-LinkExpanding 1.0")).toBe(true);
    expect(ehRobo("Mozilla/5.0 (compatible; Discordbot/2.0)")).toBe(true);
  });

  it("buscador, script e sem identificação também", () => {
    expect(ehRobo("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(ehRobo("curl/8.4.0")).toBe(true);
    expect(ehRobo("python-requests/2.31.0")).toBe(true);
    expect(ehRobo("")).toBe(true);
    expect(ehRobo(null)).toBe(true);
    expect(ehRobo(undefined)).toBe(true);
  });

  it("navegador de gente passa", () => {
    expect(ehRobo(CHROME)).toBe(false);
    expect(
      ehRobo(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
    expect(
      ehRobo(
        "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.165 Mobile Safari/537.36",
      ),
    ).toBe(false);
  });
});
