import { createDb } from "@/db/client";
import { seedContent } from "@/db/seed-lib";

const { db, pool } = createDb();
seedContent(db, console.log, { allowOverwrite: process.env.SEED_ALLOW_OVERWRITE === "1" })
  .then((r) => console.log(`Seeded ${r.missions} missions, ${r.companies} companies, ${r.dossiers} dossiers.`))
  .catch((e) => {
    console.error((e instanceof Error ? e.message : String(e)).split("\n")[0].slice(0, 300), e?.cause ?? "");
    process.exitCode = 1;
  })
  .finally(() => pool.end());
