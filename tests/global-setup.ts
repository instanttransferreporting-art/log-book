import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const TEST_URL = "postgresql://postgres:postgres@localhost:5433/logbook_test?schema=public";

export default async function setup() {
  const admin = new PrismaClient({ datasourceUrl: "postgresql://postgres:postgres@localhost:5433/postgres" });
  const exists = await admin.$queryRaw<unknown[]>`SELECT 1 FROM pg_database WHERE datname = 'logbook_test'`;
  if (exists.length === 0) await admin.$executeRawUnsafe("CREATE DATABASE logbook_test");
  await admin.$disconnect();
  const env = { ...process.env, DATABASE_URL: TEST_URL, DIRECT_URL: TEST_URL };
  execSync("npx prisma migrate deploy", { env, stdio: "ignore" });
  execSync("npx prisma db seed", { env, stdio: "ignore" }); // rôles, permissions (idempotent)
}
