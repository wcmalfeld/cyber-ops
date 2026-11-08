import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const testDb = process.env.TEST_DATABASE_URL ?? "postgres://cyberops:cyberops_dev@localhost:5432/cyberops_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: { DATABASE_URL: testDb, TEST_DATABASE_URL: testDb },
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
