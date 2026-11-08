import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __cyberopsPool?: Pool };

function getPool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  // Reuse one pool across hot reloads in development.
  globalForDb.__cyberopsPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  return globalForDb.__cyberopsPool;
}

export const db: DB = drizzle(getPool(), { schema });
export { schema };
