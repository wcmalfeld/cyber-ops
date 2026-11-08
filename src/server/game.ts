import "server-only";
/**
 * Game service: the only code path that checks answers, records progress and awards XP.
 *
 * Invariants:
 *  - Correctness is decided here from the server-held definition; the client only sends answers.
 *  - A task is solved at most once (`solved_at IS NULL` guard), and every XP award goes
 *    through a ledger row keyed by (user, source_key), so replays and races cannot farm XP.
 *  - Terminal state lives server-side; observation objectives are judged from it.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { Mission, Task } from "@/engine/schema";
import { execute, initialTerminalState, type TerminalState } from "@/engine/terminal/interpreter";
import { isObserved, validateSubmission, type Submission } from "@/engine/validate";
import { HINTS_PER_TASK, MIN_FAILED_ATTEMPTS_FOR_SOLUTION, awardedTaskXp, canRevealSolution, rankFor } from "@/engine/progression";
import type { AchievementId } from "@/content/achievements";
import { getMission } from "./missions-repo";

export class GameError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

export interface TaskProgressView {
  solved: boolean;
  attempts: number;
  hintsUsed: number;
  solutionRevealed: boolean;
  hints: string[];
  solution: string | null;
  explanation: string | null;
  canRevealSolution: boolean;
}

// ── reads ──────────────────────────────────────────────────────────────────

export async function totalXp(db: DB, userId: string): Promise<number> {
  const [row] = await db
    .select({ xp: sql<number>`coalesce(sum(${s.xpTransactions.amount}), 0)::int` })
    .from(s.xpTransactions)
    .where(eq(s.xpTransactions.userId, userId));
  return row?.xp ?? 0;
}

async function progressRows(db: DB, userId: string, missionId: string) {
  return db
    .select()
    .from(s.taskProgress)
    .where(and(eq(s.taskProgress.userId, userId), eq(s.taskProgress.missionId, missionId)));
}

export function taskView(task: Task, row: typeof s.taskProgress.$inferSelect | undefined): TaskProgressView {
  const p = {
    solved: !!row?.solvedAt,
    attempts: row?.attempts ?? 0,
    hintsUsed: row?.hintsUsed ?? 0,
    solutionRevealed: row?.solutionRevealed ?? false,
  };
  // Once solved, everything is open for review — it can no longer affect scoring.
  return {
    ...p,
    hints: p.solved ? task.hints : task.hints.slice(0, p.hintsUsed),
    solution: p.solved || p.solutionRevealed ? task.solution : null,
    explanation: p.solved ? task.explanation : null,
    canRevealSolution: !p.solved && !p.solutionRevealed && canRevealSolution(p),
  };
}

export async function getAttempt(db: DB, userId: string, missionId: string) {
  const [a] = await db
    .select()
    .from(s.missionAttempts)
    .where(and(eq(s.missionAttempts.userId, userId), eq(s.missionAttempts.missionId, missionId)));
  return a ?? null;
}

export async function getMissionProgress(db: DB, userId: string, mission: Mission) {
  const [attempt, rows] = await Promise.all([getAttempt(db, userId, mission.id), progressRows(db, userId, mission.id)]);
  const byTask = new Map(rows.map((r) => [r.taskId, r]));
  const tasks = Object.fromEntries(mission.tasks.map((t) => [t.id, taskView(t, byTask.get(t.id))]));
  return { attempt, tasks };
}

async function completedMissionIds(db: DB, userId: string): Promise<Set<string>> {
  const rows = await db.select({ id: s.missionCompletions.missionId }).from(s.missionCompletions).where(eq(s.missionCompletions.userId, userId));
  return new Set(rows.map((r) => r.id));
}

export async function prerequisiteGaps(db: DB, userId: string, mission: Mission): Promise<string[]> {
  const gaps: string[] = [];
  const done = await completedMissionIds(db, userId);
  for (const m of mission.prerequisites.missions) if (!done.has(m)) gaps.push(`Complete mission "${m}"`);
  if (mission.prerequisites.minRank > 0) {
    const rank = rankFor(await totalXp(db, userId));
    if (rank.index < mission.prerequisites.minRank) gaps.push(`Reach rank ${mission.prerequisites.minRank}`);
  }
  return gaps;
}

// ── writes ─────────────────────────────────────────────────────────────────

async function loadMission(db: DB, missionId: string, version?: number) {
  const m = await getMission(db, missionId, version);
  if (!m) throw new GameError("Mission not found", 404);
  return m;
}

/** Load the mission at the version the user's attempt was started on. */
async function loadForAttempt(db: DB, userId: string, missionId: string) {
  const attempt = await getAttempt(db, userId, missionId);
  if (!attempt) throw new GameError("Start the mission first", 409);
  return { attempt, mission: await loadMission(db, missionId, attempt.version) };
}

export async function startMission(db: DB, userId: string, missionId: string) {
  const mission = await loadMission(db, missionId);
  const gaps = await prerequisiteGaps(db, userId, mission);
  if (gaps.length) throw new GameError(`Locked: ${gaps.join("; ")}`, 403);
  await db
    .insert(s.missionAttempts)
    .values({ userId, missionId, version: mission.version })
    .onConflictDoUpdate({
      target: [s.missionAttempts.userId, s.missionAttempts.missionId],
      set: { lastActiveAt: new Date() },
    });
  return getAttempt(db, userId, missionId);
}

async function ensureProgressRow(db: DB, userId: string, missionId: string, taskId: string) {
  await db.insert(s.taskProgress).values({ userId, missionId, taskId }).onConflictDoNothing();
}

async function grantXp(db: DB, userId: string, amount: number, sourceKey: string, reason: string): Promise<number> {
  if (amount <= 0) return 0;
  const inserted = await db
    .insert(s.xpTransactions)
    .values({ userId, amount, sourceKey, reason })
    .onConflictDoNothing()
    .returning({ amount: s.xpTransactions.amount });
  return inserted[0]?.amount ?? 0;
}

async function grantAchievement(db: DB, userId: string, achievementId: AchievementId): Promise<boolean> {
  const r = await db.insert(s.userAchievements).values({ userId, achievementId }).onConflictDoNothing().returning();
  return r.length > 0;
}

/** Mark a task solved (once) and award its XP. Returns XP awarded, 0 if already solved. */
async function solveTask(db: DB, userId: string, mission: Mission, task: Task) {
  await ensureProgressRow(db, userId, mission.id, task.id);
  const updated = await db
    .update(s.taskProgress)
    .set({ solvedAt: new Date() })
    .where(
      and(
        eq(s.taskProgress.userId, userId),
        eq(s.taskProgress.missionId, mission.id),
        eq(s.taskProgress.taskId, task.id),
        isNull(s.taskProgress.solvedAt),
      ),
    )
    .returning();
  if (!updated.length) return { xp: 0, achievements: [] as AchievementId[] };
  const row = updated[0];
  const xp = await grantXp(db, userId, awardedTaskXp(task.xp, row), `task:${mission.id}:${task.id}`, `Objective: ${task.title}`);
  const achievements: AchievementId[] = [];
  if (task.kind === "flag" && (await grantAchievement(db, userId, "first-flag"))) achievements.push("first-flag");
  return { xp, achievements };
}

function unmetRequirements(mission: Mission, task: Task, solved: Set<string>) {
  return task.requires.filter((r) => !solved.has(r)).map((r) => mission.tasks.find((t) => t.id === r)?.title ?? r);
}

export async function submitAnswer(db: DB, userId: string, missionId: string, taskId: string, submission: Submission) {
  const { attempt, mission } = await loadForAttempt(db, userId, missionId);
  const task = mission.tasks.find((t) => t.id === taskId);
  // Answers are bound to (mission, task); a flag from another mission cannot be "accidentally" accepted.
  if (!task) throw new GameError("Unknown objective for this mission", 404);

  const rows = await progressRows(db, userId, missionId);
  const solved = new Set(rows.filter((r) => r.solvedAt).map((r) => r.taskId));
  if (solved.has(taskId)) return { correct: true, alreadySolved: true, message: "Already solved.", xpAwarded: 0, achievements: [], explanation: task.explanation };
  const blocked = unmetRequirements(mission, task, solved);
  if (blocked.length) throw new GameError(`Complete first: ${blocked.join(", ")}`, 409);

  const result = validateSubmission(task, submission);
  await db.insert(s.submissions).values({ userId, missionId, version: attempt.version, taskId, payload: submission, correct: result.correct });
  await db.update(s.missionAttempts).set({ lastActiveAt: new Date() }).where(eq(s.missionAttempts.id, attempt.id));

  if (!result.correct) {
    await ensureProgressRow(db, userId, missionId, taskId);
    await db
      .update(s.taskProgress)
      .set({ attempts: sql`${s.taskProgress.attempts} + 1` })
      .where(and(eq(s.taskProgress.userId, userId), eq(s.taskProgress.missionId, missionId), eq(s.taskProgress.taskId, taskId)));
    return { correct: false, alreadySolved: false, message: result.message, xpAwarded: 0, achievements: [], explanation: null };
  }
  const { xp, achievements } = await solveTask(db, userId, mission, task);
  return { correct: true, alreadySolved: false, message: result.message, xpAwarded: xp, achievements, explanation: task.explanation };
}

export async function revealHint(db: DB, userId: string, missionId: string, taskId: string) {
  const { mission } = await loadForAttempt(db, userId, missionId);
  const task = mission.tasks.find((t) => t.id === taskId);
  if (!task) throw new GameError("Unknown objective for this mission", 404);
  await ensureProgressRow(db, userId, missionId, taskId);
  const [row] = await db
    .select()
    .from(s.taskProgress)
    .where(and(eq(s.taskProgress.userId, userId), eq(s.taskProgress.missionId, missionId), eq(s.taskProgress.taskId, taskId)));

  const progress = { solved: !!row.solvedAt, attempts: row.attempts, hintsUsed: row.hintsUsed, solutionRevealed: row.solutionRevealed };
  if (progress.solved || progress.solutionRevealed) return taskView(task, row);

  if (row.hintsUsed < HINTS_PER_TASK) {
    // Guarded increment so concurrent clicks reveal hints in order, never skipping or double-counting.
    const [u] = await db
      .update(s.taskProgress)
      .set({ hintsUsed: sql`${s.taskProgress.hintsUsed} + 1` })
      .where(
        and(
          eq(s.taskProgress.userId, userId),
          eq(s.taskProgress.missionId, missionId),
          eq(s.taskProgress.taskId, taskId),
          eq(s.taskProgress.hintsUsed, row.hintsUsed),
        ),
      )
      .returning();
    if (u) await db.insert(s.hintReveals).values({ userId, missionId, taskId, hintIndex: row.hintsUsed }).onConflictDoNothing();
    return taskView(task, u ?? row);
  }

  if (!canRevealSolution(progress))
    throw new GameError(
      `The full walkthrough unlocks after every hint and ${MIN_FAILED_ATTEMPTS_FOR_SOLUTION} genuine attempts — you're closer than you think.`,
      403,
    );
  const [u] = await db
    .update(s.taskProgress)
    .set({ solutionRevealed: true })
    .where(and(eq(s.taskProgress.userId, userId), eq(s.taskProgress.missionId, missionId), eq(s.taskProgress.taskId, taskId)))
    .returning();
  await db.insert(s.hintReveals).values({ userId, missionId, taskId, hintIndex: HINTS_PER_TASK }).onConflictDoNothing();
  return taskView(task, u);
}

// ── terminal ───────────────────────────────────────────────────────────────

async function loadTerminalState(db: DB, userId: string, mission: Mission): Promise<TerminalState> {
  const [lab] = await db
    .select()
    .from(s.labSessions)
    .where(and(eq(s.labSessions.userId, userId), eq(s.labSessions.missionId, mission.id), eq(s.labSessions.kind, "simulated_terminal")));
  return (lab?.state as TerminalState | undefined) ?? initialTerminalState(mission.terminal!);
}

export async function terminalSnapshot(db: DB, userId: string, mission: Mission) {
  if (!mission.terminal) return null;
  const st = await loadTerminalState(db, userId, mission);
  return { cwd: st.cwd, history: st.history.slice(-50) };
}

export async function runTerminalCommand(db: DB, userId: string, missionId: string, input: string) {
  const { mission } = await loadForAttempt(db, userId, missionId);
  if (!mission.terminal) throw new GameError("This mission has no terminal", 400);
  const prior = await loadTerminalState(db, userId, mission);
  const result = execute(mission.terminal, prior, input);
  await db
    .insert(s.labSessions)
    .values({ userId, missionId, kind: "simulated_terminal", state: result.state })
    .onConflictDoUpdate({
      target: [s.labSessions.userId, s.labSessions.missionId, s.labSessions.kind],
      set: { state: result.state, updatedAt: new Date() },
    });

  const solvedNow: { taskId: string; xp: number; explanation: string }[] = [];
  const rows = await progressRows(db, userId, missionId);
  const solved = new Set(rows.filter((r) => r.solvedAt).map((r) => r.taskId));
  for (const task of mission.tasks) {
    if (task.kind !== "terminal_observation" || solved.has(task.id)) continue;
    if (unmetRequirements(mission, task, solved).length) continue;
    if (!isObserved(task.condition, result.state.observed)) continue;
    const { xp } = await solveTask(db, userId, mission, task);
    solvedNow.push({ taskId: task.id, xp, explanation: task.explanation });
  }
  return { output: result.output, clear: result.clear, cwd: result.state.cwd, solved: solvedNow };
}

export async function resetTerminal(db: DB, userId: string, missionId: string) {
  const { mission } = await loadForAttempt(db, userId, missionId);
  if (!mission.terminal) throw new GameError("This mission has no terminal", 400);
  // Reset filesystem state but keep what the user has already observed (it's been earned).
  const prior = await loadTerminalState(db, userId, mission);
  const fresh = { ...initialTerminalState(mission.terminal), observed: prior.observed };
  await db
    .update(s.labSessions)
    .set({ state: fresh, updatedAt: new Date() })
    .where(and(eq(s.labSessions.userId, userId), eq(s.labSessions.missionId, missionId)));
  return { cwd: fresh.cwd };
}

// ── completion ─────────────────────────────────────────────────────────────

export async function completeMission(db: DB, userId: string, missionId: string) {
  const { attempt, mission } = await loadForAttempt(db, userId, missionId);
  const rows = await progressRows(db, userId, missionId);
  const byTask = new Map(rows.map((r) => [r.taskId, r]));
  const unsolved = mission.tasks.filter((t) => !byTask.get(t.id)?.solvedAt);
  if (unsolved.length) throw new GameError(`${unsolved.length} objective(s) remain`, 409);

  const independent = mission.tasks.every((t) => {
    const r = byTask.get(t.id)!;
    return r.hintsUsed === 0 && !r.solutionRevealed;
  });

  const bonus = await grantXp(db, userId, mission.completionXp, `mission:${mission.id}`, `Mission complete: ${mission.title}`);
  const inserted = await db
    .insert(s.missionCompletions)
    .values({ userId, missionId, version: attempt.version, xpAwarded: bonus, independent })
    .onConflictDoNothing()
    .returning();
  await db
    .update(s.missionAttempts)
    .set({ status: "completed", completedAt: attempt.completedAt ?? new Date() })
    .where(eq(s.missionAttempts.id, attempt.id));

  const achievements: AchievementId[] = [];
  if (inserted.length) {
    if (await grantAchievement(db, userId, "first-mission")) achievements.push("first-mission");
    if (independent && (await grantAchievement(db, userId, "independent-operator"))) achievements.push("independent-operator");
    if (mission.dossierId && (await grantAchievement(db, userId, "dossier-investigator"))) achievements.push("dossier-investigator");
  }
  return { firstCompletion: inserted.length > 0, xpAwarded: bonus, independent, achievements };
}
