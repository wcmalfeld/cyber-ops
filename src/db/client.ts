/** Non-"server-only" factory for scripts and tests (seed, vitest). */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url, max: 5 });
  return { db: drizzle(pool, { schema }), pool };
}
