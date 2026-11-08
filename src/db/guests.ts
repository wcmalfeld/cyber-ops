/** Guest housekeeping. Kept free of "server-only" so scripts and tests can import it. */
import { and, eq, lt, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as s from "./schema";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes guests that have no live session and are older than a day; their progress
 * cascades away with them. Sessions last 30 days, so an untouched guest is pruned
 * once its cookie has expired.
 */
export async function pruneStaleGuests(database: NodePgDatabase<typeof s>, now = new Date()) {
  const rows = await database
    .delete(s.users)
    .where(
      and(
        eq(s.users.isGuest, true),
        lt(s.users.createdAt, new Date(now.getTime() - DAY_MS)),
        sql`NOT EXISTS (SELECT 1 FROM ${s.sessions} WHERE ${s.sessions.userId} = ${s.users.id} AND ${s.sessions.expiresAt} > ${now})`,
      ),
    )
    .returning({ id: s.users.id });
  return rows.length;
}
