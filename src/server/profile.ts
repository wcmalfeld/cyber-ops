import "server-only";
import { desc, eq } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { SKILLS, type Mission, type SkillId } from "@/engine/schema";
import { computeMastery, rankFor, type SkillEvidence, type SkillMastery } from "@/engine/progression";
import { listMissions } from "./missions-repo";
import { prerequisiteGaps, totalXp } from "./game";

export type MissionStatus = "completed" | "in_progress" | "available" | "locked";

export interface MissionCard {
  mission: Mission;
  status: MissionStatus;
  recommended: boolean;
  lockedReasons: string[];
  solvedTasks: number;
}

export async function skillMasteries(db: DB, userId: string, missions?: Mission[]): Promise<SkillMastery[]> {
  const all = missions ?? (await listMissions(db));
  const rows = await db.select().from(s.taskProgress).where(eq(s.taskProgress.userId, userId));
  const byMission = new Map(all.map((m) => [m.id, m]));
  const evidence: SkillEvidence[] = [];
  for (const r of rows) {
    if (!r.solvedAt) continue;
    const m = byMission.get(r.missionId);
    const t = m?.tasks.find((x) => x.id === r.taskId);
    if (!m || !t) continue;
    for (const sw of t.skills)
      evidence.push({ skill: sw.skill, weight: sw.weight, missionId: m.id, difficulty: m.difficulty, attempts: r.attempts, hintsUsed: r.hintsUsed, solutionRevealed: r.solutionRevealed });
  }
  return SKILLS.map((sk) => computeMastery(sk, evidence));
}

export async function missionCards(db: DB, userId: string): Promise<MissionCard[]> {
  const missions = await listMissions(db);
  const [attempts, completions, progress] = await Promise.all([
    db.select().from(s.missionAttempts).where(eq(s.missionAttempts.userId, userId)),
    db.select().from(s.missionCompletions).where(eq(s.missionCompletions.userId, userId)),
    db.select().from(s.taskProgress).where(eq(s.taskProgress.userId, userId)),
  ]);
  const done = new Set(completions.map((c) => c.missionId));
  const started = new Set(attempts.map((a) => a.missionId));
  const cards: MissionCard[] = [];
  for (const m of missions) {
    const gaps = done.has(m.id) ? [] : await prerequisiteGaps(db, userId, m);
    const status: MissionStatus = done.has(m.id) ? "completed" : gaps.length ? "locked" : started.has(m.id) ? "in_progress" : "available";
    cards.push({
      mission: m,
      status,
      recommended: false,
      lockedReasons: gaps,
      solvedTasks: progress.filter((p) => p.missionId === m.id && p.solvedAt).length,
    });
  }
  // Recommend: an in-progress mission first; otherwise the lowest-level available mission
  // whose soft "recommendedAfter" missions are done.
  const rec =
    cards.find((c) => c.status === "in_progress") ??
    cards.find((c) => c.status === "available" && c.mission.recommendedAfter.every((r) => done.has(r))) ??
    cards.find((c) => c.status === "available");
  if (rec) rec.recommended = true;
  return cards;
}

export async function userSummary(db: DB, userId: string) {
  const [xp, profile, cards, achievements, recent] = await Promise.all([
    totalXp(db, userId),
    db.select().from(s.userProfiles).where(eq(s.userProfiles.userId, userId)).then((r) => r[0]),
    missionCards(db, userId),
    db
      .select({ id: s.achievements.id, name: s.achievements.name, description: s.achievements.description, earnedAt: s.userAchievements.earnedAt })
      .from(s.achievements)
      .leftJoin(s.userAchievements, eq(s.userAchievements.achievementId, s.achievements.id))
      .where(eq(s.userAchievements.userId, userId)),
    db.select().from(s.missionCompletions).where(eq(s.missionCompletions.userId, userId)).orderBy(desc(s.missionCompletions.completedAt)).limit(5),
  ]);
  const allAchievements = await db.select().from(s.achievements);
  const skills = await skillMasteries(db, userId, cards.map((c) => c.mission));
  return {
    displayName: profile?.displayName ?? "Operator",
    currentPath: profile?.currentPath ?? null,
    xp,
    rank: rankFor(xp),
    cards,
    skills,
    achievements: allAchievements.map((a) => ({ ...a, earnedAt: achievements.find((e) => e.id === a.id)?.earnedAt ?? null })),
    recent: recent.map((r) => ({ ...r, title: cards.find((c) => c.mission.id === r.missionId)?.mission.title ?? r.missionId })),
  };
}

/** Deterministic daily pick so every user sees the same featured item on a given UTC day. */
export function dailyIndex(length: number, date = new Date()): number {
  if (length === 0) return 0;
  const day = Math.floor(date.getTime() / 86_400_000);
  return day % length;
}

export async function snapshotSkills(db: DB, userId: string, trigger: string) {
  const masteries = await skillMasteries(db, userId);
  const nonZero = masteries.filter((m) => m.score > 0);
  if (nonZero.length)
    await db.insert(s.skillAssessments).values(nonZero.map((m) => ({ userId, skillId: m.skill as SkillId, score: m.score, level: m.level, trigger })));
  return masteries;
}
