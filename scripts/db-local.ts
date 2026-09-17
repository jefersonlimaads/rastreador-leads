/**
 * Postgres local de desenvolvimento, sem Docker e sem instalar nada no sistema.
 * Os dados ficam em .db-local/, que está no .gitignore.
 *
 *   npm run db:start   sobe o banco em localhost:5433
 *   npm run db:stop    derruba
 *
 * Em produção isso não é usado: lá o DATABASE_URL aponta para o Supabase.
 */
import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import fs from "node:fs";

const dataDir = path.join(process.cwd(), ".db-local");
const pidFile = path.join(dataDir, "..", ".db-local.pid");

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "jlads",
  password: "jlads",
  port: 5433,
  persistent: true,
});

async function start() {
  const primeiraVez = !fs.existsSync(dataDir);
  if (primeiraVez) {
    console.log("Inicializando o banco local pela primeira vez...");
    await pg.initialise();
  }
  await pg.start();
  if (primeiraVez) {
    await pg.createDatabase("rastreador");
  }
  fs.writeFileSync(pidFile, String(process.pid));
  console.log("Postgres local no ar em postgresql://jlads:jlads@localhost:5433/rastreador");
  console.log("Para parar: npm run db:stop");
  // Mantém o processo vivo enquanto o banco estiver servindo.
  process.stdin.resume();
  const encerrar = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", encerrar);
  process.on("SIGTERM", encerrar);
}

async function stop() {
  await pg.stop();
  console.log("Postgres local parado.");
}

const comando = process.argv[2];
if (comando === "stop") {
  stop().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  start().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
