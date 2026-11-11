import { defineConfig } from "@playwright/test";

const PORT = 3100;
const TEST_DB = "postgresql://postgres:postgres@localhost:5433/logbook_test?schema=public";

// Serveur Next dédié (port 3100, base de test, dossier de build séparé) : n'interfère pas avec le serveur de développement.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 30_000 }, // le serveur de dev compile les pages à la première visite
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, locale: "fr-FR" },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: TEST_DB, NEXT_DIST_DIR: ".next-e2e", AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-0123", AUTH_TRUST_HOST: "true", STORAGE_DIR: "storage-test" },
  },
});
