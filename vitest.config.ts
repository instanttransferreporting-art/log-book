import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // Base dédiée aux tests : ne touche jamais aux données de développement
    env: { DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/logbook_test?schema=public", STORAGE_DIR: "storage-test" },
    fileParallelism: false,
  },
});
