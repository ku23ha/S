import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    environment: "node",
    // In-memory Postgres (PGlite) can take several seconds to start on a busy machine.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
