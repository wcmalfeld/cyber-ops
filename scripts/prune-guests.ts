import { createDb } from "@/db/client";
import { pruneStaleGuests } from "@/db/guests";

const { db, pool } = createDb();
pruneStaleGuests(db)
  .then((n) => console.log(`Pruned ${n} stale guest account${n === 1 ? "" : "s"}.`))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  })
  .finally(() => pool.end());
