/**
 * XP, ranks, assisted-completion scoring and skill mastery (PRD §8).
 *
 * XP measures activity; mastery measures demonstrated competence. They are computed
 * separately on purpose: ten easy Linux tasks earn plenty of XP but cannot, on their
 * own, make someone "Advanced" — mastery levels are gated by breadth (distinct
 * missions) and by the difficulty of the evidence.
 */
import type { Difficulty, SkillId } from "./schema";

export const RANKS = [
  { index: 0, name: "Recruit", minXp: 0 },
  { index: 1, name: "Junior Analyst", minXp: 300 },
  { index: 2, name: "Security Analyst", minXp: 1000 },
  { index: 3, name: "Security Engineer", minXp: 2500 },
  { index: 4, name: "Senior Operator", minXp: 5000 },
  { index: 5, name: "Elite Specialist", minXp: 9000 },
] as const;

export function rankFor(xp: number) {
  let rank: (typeof RANKS)[number] = RANKS[0];
  for (const r of RANKS) if (xp >= r.minXp) rank = r;
  const next = RANKS[rank.index + 1];
  const progress = next ? (xp - rank.minXp) / (next.minXp - rank.minXp) : 1;
  return { ...rank, next: next ?? null, progress: Math.max(0, Math.min(1, progress)) };
}

export const LEVEL_NAMES = [
  "Orientation",
  "Junior Analyst",
  "Security Analyst",
  "Security Engineer",
  "Advanced Operator",
  "Specialist",
] as const;

// ── hints & assisted completion ────────────────────────────────────────────

export const HINTS_PER_TASK = 4;
export const MIN_FAILED_ATTEMPTS_FOR_SOLUTION = 3;

export interface TaskProgressLike {
  solved: boolean;
  attempts: number; // incorrect submissions
  hintsUsed: number;
  solutionRevealed: boolean;
}

/**
 * The walkthrough is a learning tool, not a shortcut: it unlocks after the task is
 * solved, or after the learner has used every hint *and* made a genuine attempt.
 */
export function canRevealSolution(p: TaskProgressLike): boolean {
  return p.solved || (p.hintsUsed >= HINTS_PER_TASK && p.attempts >= MIN_FAILED_ATTEMPTS_FOR_SOLUTION);
}

/**
 * Assisted work earns less XP but never zero — the system should not punish asking
 * for help (PRD §8.5). Each hint costs 10%, floor 50%; a revealed solution earns 25%.
 */
export function taskXpMultiplier(p: Pick<TaskProgressLike, "hintsUsed" | "solutionRevealed">): number {
  if (p.solutionRevealed) return 0.25;
  return Math.max(0.5, 1 - 0.1 * p.hintsUsed);
}

export function awardedTaskXp(baseXp: number, p: Pick<TaskProgressLike, "hintsUsed" | "solutionRevealed">) {
  return Math.round(baseXp * taskXpMultiplier(p));
}

// ── skill mastery ──────────────────────────────────────────────────────────

export const DIFFICULTY_FACTOR: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3.5,
  very_hard: 5,
  expert: 7,
};
const DIFFICULTY_RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2, very_hard: 3, expert: 4 };

export const MASTERY_LEVELS = [
  { name: "Unrated", minScore: 0, minMissions: 0, minDifficulty: "easy" },
  { name: "Novice", minScore: 1, minMissions: 1, minDifficulty: "easy" },
  { name: "Apprentice", minScore: 4, minMissions: 1, minDifficulty: "easy" },
  { name: "Practitioner", minScore: 10, minMissions: 2, minDifficulty: "medium" },
  { name: "Proficient", minScore: 22, minMissions: 3, minDifficulty: "hard" },
  { name: "Advanced", minScore: 40, minMissions: 5, minDifficulty: "very_hard" },
  { name: "Expert", minScore: 65, minMissions: 7, minDifficulty: "expert" },
] as const satisfies readonly { name: string; minScore: number; minMissions: number; minDifficulty: Difficulty }[];

export type MasteryName = (typeof MASTERY_LEVELS)[number]["name"];

/** One solved task's contribution toward a skill. */
export interface SkillEvidence {
  skill: SkillId;
  weight: number;
  missionId: string;
  difficulty: Difficulty;
  attempts: number;
  hintsUsed: number;
  solutionRevealed: boolean;
}

/** How much a solved task demonstrates, based on independence. */
export function qualityFactor(e: Pick<SkillEvidence, "attempts" | "hintsUsed" | "solutionRevealed">): number {
  if (e.solutionRevealed) return 0.3;
  if (e.hintsUsed > 0) return Math.max(0.5, 0.8 - 0.075 * e.hintsUsed);
  if (e.attempts === 0) return 1;
  return Math.max(0.7, 1 - 0.1 * e.attempts);
}

export interface SkillMastery {
  skill: SkillId;
  score: number;
  level: MasteryName;
  levelIndex: number;
  missions: number;
  hardestDifficulty: Difficulty | null;
  /** What is holding the next level back, in plain language. */
  nextRequirement: string | null;
}

export function computeMastery(skill: SkillId, evidence: SkillEvidence[]): SkillMastery {
  const mine = evidence.filter((e) => e.skill === skill);
  const score = mine.reduce((s, e) => s + e.weight * DIFFICULTY_FACTOR[e.difficulty] * qualityFactor(e), 0);
  const missions = new Set(mine.map((e) => e.missionId)).size;
  // Only independent work counts toward the difficulty ceiling.
  const independent = mine.filter((e) => !e.solutionRevealed);
  const hardest = independent.reduce<Difficulty | null>(
    (h, e) => (h === null || DIFFICULTY_RANK[e.difficulty] > DIFFICULTY_RANK[h] ? e.difficulty : h),
    null,
  );

  let levelIndex = 0;
  for (let i = 1; i < MASTERY_LEVELS.length; i++) {
    const L = MASTERY_LEVELS[i];
    const meetsDifficulty = hardest !== null && DIFFICULTY_RANK[hardest] >= DIFFICULTY_RANK[L.minDifficulty];
    if (score >= L.minScore && missions >= L.minMissions && meetsDifficulty) levelIndex = i;
    else break;
  }

  const next = MASTERY_LEVELS[levelIndex + 1];
  let nextRequirement: string | null = null;
  if (next) {
    const gaps: string[] = [];
    if (score < next.minScore) gaps.push(`${(next.minScore - score).toFixed(1)} more mastery points`);
    if (missions < next.minMissions) gaps.push(`evidence from ${next.minMissions - missions} more mission(s)`);
    if (hardest === null || DIFFICULTY_RANK[hardest] < DIFFICULTY_RANK[next.minDifficulty])
      gaps.push(`an independently solved ${next.minDifficulty.replace("_", " ")}+ task`);
    nextRequirement = gaps.length ? `${next.name}: needs ${gaps.join(", ")}` : null;
  }

  return {
    skill,
    score: Math.round(score * 10) / 10,
    level: MASTERY_LEVELS[levelIndex].name,
    levelIndex,
    missions,
    hardestDifficulty: hardest,
    nextRequirement,
  };
}
