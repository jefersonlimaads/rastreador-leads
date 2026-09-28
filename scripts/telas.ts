/**
 * Gera os prints do guia de navegação.
 *
 * Roda contra o ambiente local com os dados de demonstração, entra com um
 * usuário administrador e fotografa cada tela. Reproduzível de propósito:
 * quando a interface mudar, `npm run telas` refaz o guia inteiro em vez de
 * alguém recortar tela por tela à mão.
 *
 *   npm run dev            (noutro terminal)
 *   npm run telas
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.TELAS_URL ?? "http://localhost:3000";
const EMAIL = process.env.TELAS_EMAIL ?? "admin@jl.ads";
const SENHA = process.env.TELAS_SENHA ?? "desenvolvimento-local-1";
const CLIENTE = process.env.TELAS_CLIENTE ?? "cliente-demo";
const DESTINO = path.join(process.cwd(), "docs", "telas");

/** Tela inteira, não só o que cabe na janela: o guia mostra a página toda. */
type Tela = { arquivo: string; url: string; espera?: string; inteira?: boolean };

const TELAS: Tela[] = [
  { arquivo: "hoje", url: `/hoje?cliente=${CLIENTE}` },
  { arquivo: "pipeline", url: `/pipeline?cliente=${CLIENTE}` },
  { arquivo: "leads", url: `/leads?cliente=${CLIENTE}` },
  { arquivo: "anuncios", url: `/anuncios?cliente=${CLIENTE}&periodo=30dias`, inteira: true },
  { arquivo: "relatorios", url: `/relatorios?cliente=${CLIENTE}`, inteira: true },
  { arquivo: "ajustes", url: `/ajustes?cliente=${CLIENTE}`, inteira: true },
  { arquivo: "negocio", url: "/negocio", inteira: true },
  { arquivo: "carteira", url: "/carteira" },
  { arquivo: "prospeccao", url: "/prospeccao" },
  { arquivo: "propostas", url: "/propostas" },
  { arquivo: "tarefas", url: "/tarefas" },
  { arquivo: "conta", url: "/conta", inteira: true },
];

async function main() {
  if (!fs.existsSync(CHROME)) {
    console.error(`Não achei o Chrome em ${CHROME}.`);
    process.exit(1);
  }
  fs.mkdirSync(DESTINO, { recursive: true });

  const navegador = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    defaultViewport: { width: 1280, height: 900, deviceScaleFactor: 2 },
    args: ["--no-sandbox"],
  });

  const pagina = await navegador.newPage();
  // Tema escuro: é como o painel é usado, e como ele foi desenhado.
  await pagina.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);

  await pagina.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await pagina.type('input[type="email"]', EMAIL);
  await pagina.type('input[type="password"]', SENHA);
  await Promise.all([
    pagina.waitForNavigation({ waitUntil: "networkidle2" }),
    pagina.click('button[type="submit"]'),
  ]);

  if (pagina.url().includes("/login")) {
    console.error("Não entrou: confira TELAS_EMAIL e TELAS_SENHA.");
    await navegador.close();
    process.exit(1);
  }

  for (const t of TELAS) {
    await pagina.goto(`${BASE}${t.url}`, { waitUntil: "networkidle2" });
    // Dá tempo de a fonte e os números renderizarem antes do clique do obturador.
    await new Promise((r) => setTimeout(r, 1200));
    const destino = path.join(DESTINO, `${t.arquivo}.png`);
    await pagina.screenshot({ path: destino as `${string}.png`, fullPage: t.inteira ?? false });
    console.log(`  ${t.arquivo}.png`);
  }

  await navegador.close();
  console.log(`\n${TELAS.length} telas em docs/telas/`);
}

main().catch((e) => {
  console.error(String(e?.message ?? e).slice(0, 300));
  process.exit(1);
});
