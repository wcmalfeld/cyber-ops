/**
 * Idempotent content seeding. Validates every authored mission, then upserts reference
 * data and stores each mission version. Mission versions are immutable: changing a
 * definition without bumping `version` is an error, so in-flight progress always
 * points at the exact content it was earned against.
 */
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { CATEGORIES } from "@/engine/schema";
import { COMPANIES } from "@/content/companies";
import { DOSSIERS } from "@/content/dossiers";
import { SKILL_INFO } from "@/content/catalog";
import { loadAuthoredMissions } from "@/content/missions";
import { ACHIEVEMENTS } from "@/content/achievements";
import * as s from "./schema";

const CATEGORY_NAMES: Record<(typeof CATEGORIES)[number], string> = {
  linux: "Linux",
  networking: "Networking",
  cryptography: "Cryptography",
  forensics: "Digital Forensics",
  soc: "SOC Operations",
  web: "Web Security",
  identity: "Identity Security",
  cloud: "Cloud Security",
  endpoint: "Endpoint Security",
  supply_chain: "Software Supply Chain",
};

export async function seedContent(
  db: NodePgDatabase<typeof s>,
  log: (m: string) => void = () => {},
  opts: { allowOverwrite?: boolean } = {},
) {
  const missions = loadAuthoredMissions();

  for (const id of CATEGORIES)
    await db.insert(s.challengeCategories).values({ id, name: CATEGORY_NAMES[id] }).onConflictDoUpdate({ target: s.challengeCategories.id, set: { name: CATEGORY_NAMES[id] } });

  for (const [id, info] of Object.entries(SKILL_INFO))
    await db.insert(s.skillDefinitions).values({ id, ...info }).onConflictDoUpdate({ target: s.skillDefinitions.id, set: info });

  for (const a of ACHIEVEMENTS)
    await db.insert(s.achievements).values(a).onConflictDoUpdate({ target: s.achievements.id, set: { name: a.name, description: a.description } });

  for (const c of COMPANIES) {
    const row = { id: c.id, name: c.name, location: c.location, website: c.website, data: c, reviewStatus: c.review.status, updatedAt: new Date() };
    await db.insert(s.companyProfiles).values(row).onConflictDoUpdate({ target: s.companyProfiles.id, set: row });
  }

  for (const d of DOSSIERS) {
    const row = { id: d.id, number: d.number, title: d.title, missionId: d.missionId, data: d, factCheckStatus: d.factCheck.status, updatedAt: new Date() };
    await db.insert(s.breachDossiers).values(row).onConflictDoUpdate({ target: s.breachDossiers.id, set: row });
    await db.delete(s.sourceReferences).where(eq(s.sourceReferences.dossierId, d.id));
    if (d.references.length)
      await db.insert(s.sourceReferences).values(d.references.map((r) => ({ dossierId: d.id, missionId: d.missionId, ...r })));
  }

  for (const m of missions) {
    const definition = JSON.parse(JSON.stringify(m));
    const checksum = createHash("sha256").update(JSON.stringify(definition)).digest("hex");
    const meta = {
      id: m.id,
      currentVersion: m.version,
      categoryId: m.category,
      path: m.path,
      difficulty: m.difficulty,
      level: m.level,
      title: m.title,
      dossierId: m.dossierId ?? null,
      updatedAt: new Date(),
    };
    await db.insert(s.missions).values(meta).onConflictDoUpdate({ target: s.missions.id, set: meta });

    const [existing] = await db
      .select({ checksum: s.missionVersions.checksum })
      .from(s.missionVersions)
      .where(and(eq(s.missionVersions.missionId, m.id), eq(s.missionVersions.version, m.version)));
    if (existing) {
      if (existing.checksum === checksum) {
        log(`  = ${m.id} v${m.version} (unchanged)`);
        continue;
      }
      if (!opts.allowOverwrite)
        throw new Error(
          `Mission ${m.id} v${m.version} changed but its version was not bumped. Increment "version", or run with SEED_ALLOW_OVERWRITE=1 in development.`,
        );
      await db.delete(s.missionObjectives).where(and(eq(s.missionObjectives.missionId, m.id), eq(s.missionObjectives.version, m.version)));
      await db.delete(s.missionEvidence).where(and(eq(s.missionEvidence.missionId, m.id), eq(s.missionEvidence.version, m.version)));
      await db.delete(s.missionVersions).where(and(eq(s.missionVersions.missionId, m.id), eq(s.missionVersions.version, m.version)));
      log(`  ~ ${m.id} v${m.version} overwritten (development only)`);
    }
    await db.insert(s.missionVersions).values({ missionId: m.id, version: m.version, definition, checksum });
    await db.insert(s.missionObjectives).values(
      m.tasks.map((t, i) => ({ missionId: m.id, version: m.version, taskId: t.id, kind: t.kind, title: t.title, xp: t.xp, position: i })),
    );
    if (m.evidence.length)
      await db.insert(s.missionEvidence).values(
        m.evidence.map((e) => ({ missionId: m.id, version: m.version, evidenceId: e.id, name: e.name, format: e.format, sizeBytes: Buffer.byteLength(e.content) })),
      );
    log(`  + ${m.id} v${m.version}`);
  }
  return { missions: missions.length, companies: COMPANIES.length, dossiers: DOSSIERS.length };
}
