import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // The first test imports many route modules (cold transform).
    testTimeout: 30_000,
    // API tests use the in-memory repository (no DATABASE_URL, no data folder).
    env: { DATABASE_URL: "", DATA_IMPORT_DIR: "" },
  },
});
