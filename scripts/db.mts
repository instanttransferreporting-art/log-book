// Démarre un PostgreSQL local embarqué (dev uniquement) sur le port 5433.
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";

const dataDir = "./.pgdata";
const first = !fs.existsSync(dataDir);
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: 5433,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});
if (first) await pg.initialise();
await pg.start();
if (first) await pg.createDatabase("logbook");
console.log("PostgreSQL prêt sur localhost:5433");
process.on("SIGINT", async () => { await pg.stop(); process.exit(0); });
process.on("SIGTERM", async () => { await pg.stop(); process.exit(0); });
setInterval(() => {}, 1 << 30);
