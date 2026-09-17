import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // Os testes de atribuição compartilham o banco local: rodam em série.
    fileParallelism: false,
    environment: "node",
    alias: {
      // Fora do Next, "server-only" não resolve: aqui ele vira um módulo vazio.
      "server-only": path.resolve(process.cwd(), "tests/server-only.ts"),
    },
  },
});
