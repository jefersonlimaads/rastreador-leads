/**
 * Migração no deploy.
 *
 * Roda antes do build. Sem isso, o código novo subia na hora e o banco só
 * mudava quando alguém lembrasse de rodar o comando na mão — e entre uma coisa
 * e outra a tela quebrava para quem estivesse usando.
 *
 * Regras:
 *   - só roda quando VERCEL_ENV é "production": deploy de preview não pode
 *     mexer no banco de produção;
 *   - usa DIRECT_URL (porta 5432), porque o pooler do Supabase não aceita
 *     comando de criação de tabela;
 *   - sem DIRECT_URL, não faz nada e deixa o build seguir. Assim o build local
 *     e o de um ambiente novo não param por causa disso.
 *
 * Falha na migração derruba o build de propósito: é melhor não publicar do que
 * publicar código que conversa com um banco que não existe mais.
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";

const naVercel = process.env.VERCEL === "1";
const producao = process.env.VERCEL_ENV === "production";
const direta = process.env.DIRECT_URL;

if (naVercel && !producao) {
  console.log("[migrar] Deploy de preview: não mexe no banco.");
} else if (!direta) {
  console.log("[migrar] Sem DIRECT_URL: pulando as migrações.");
} else {
  if (!/:5432\//.test(direta)) {
    console.warn("[migrar] Aviso: DIRECT_URL não está na porta 5432. Pode falhar no pooler.");
  }
  console.log("[migrar] Aplicando migrações pendentes...");
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    // A senha só existe no processo filho, nunca no log do build.
    env: { ...process.env, DATABASE_URL: direta },
  });
  console.log("[migrar] Banco em dia.");
}
