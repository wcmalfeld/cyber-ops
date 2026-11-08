import "server-only";
import { and, eq } from "drizzle-orm";
import { DIFFICULTIES, missionSchema, type Mission } from "@/engine/schema";
import type { DB } from "@/db";
import * as s from "@/db/schema";

/** Parsed definitions are immutable per (id, version), so caching them is safe. */
const cache = new Map<string, Mission>();

function parse(row: { missionId: string; version: number; definition: unknown }): Mission {
  const key = `${row.missionId}@${row.version}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const mission = missionSchema.parse(row.definition);
  cache.set(key, mission);
  return mission;
}

export async function getMission(db: DB, missionId: string, version?: number): Promise<Mission | null> {
  const [meta] = await db.select().from(s.missions).where(eq(s.missions.id, missionId));
  if (!meta || !meta.published) return null;
  const v = version ?? meta.currentVersion;
  const [row] = await db
    .select()
    .from(s.missionVersions)
    .where(and(eq(s.missionVersions.missionId, missionId), eq(s.missionVersions.version, v)));
  return row ? parse(row) : null;
}

export async function listMissions(db: DB): Promise<Mission[]> {
  const rows = await db
    .select({ missionId: s.missionVersions.missionId, version: s.missionVersions.version, definition: s.missionVersions.definition })
    .from(s.missionVersions)
    .innerJoin(s.missions, and(eq(s.missions.id, s.missionVersions.missionId), eq(s.missions.currentVersion, s.missionVersions.version)))
    .where(eq(s.missions.published, true));
  const d = (m: Mission) => DIFFICULTIES.indexOf(m.difficulty);
  return rows.map(parse).sort((a, b) => a.level - b.level || d(a) - d(b) || a.id.localeCompare(b.id));
}
