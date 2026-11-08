import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { ATTACK_SUCCESS_EVENT_ID, ATTACKER_FAILURE_COUNT } from "@/content/missions/who-logged-in";
import {
  completeMission,
  getMissionProgress,
  revealHint,
  runTerminalCommand,
  startMission,
  submitAnswer,
  totalXp,
  prerequisiteGaps,
} from "@/server/game";
import { getMission, listMissions } from "@/server/missions-repo";
import { missionCards, skillMasteries, userSummary } from "@/server/profile";
import { db, makeUser, pool, resetDatabase } from "./helpers";

const M1 = "hidden-in-plain-sight";
const M2 = "who-logged-in";
const M3 = "the-unlocked-door";

beforeAll(resetDatabase);
afterAll(() => pool.end());

let user: string;
beforeEach(async () => {
  user = await makeUser();
});

describe("mission lifecycle", () => {
  it("serves missions from the database", async () => {
    const all = await listMissions(db);
    expect(all.map((m) => m.id)).toEqual([M1, M2, M3]);
    expect((await getMission(db, M1))?.version).toBe(1);
    expect(await getMission(db, "nope")).toBeNull();
  });

  it("requires starting a mission before interacting", async () => {
    await expect(submitAnswer(db, user, M1, "mentor-flag", { kind: "flag", value: "CYBEROPS{x}" })).rejects.toThrow(/Start the mission/);
    await expect(runTerminalCommand(db, user, M1, "ls")).rejects.toThrow(/Start the mission/);
  });

  it("plays Mission 1 end to end via terminal + submissions", async () => {
    await startMission(db, user, M1);

    // Observation objective solves itself from real terminal state.
    const ls = await runTerminalCommand(db, user, M1, "ls");
    expect(ls.solved).toEqual([]);
    const la = await runTerminalCommand(db, user, M1, "ls -la");
    expect(la.solved.map((x) => x.taskId)).toEqual(["reveal-hidden"]);
    expect(la.solved[0].xp).toBe(50);

    // Terminal state persists between requests (server-held cwd and chmod overlay).
    await runTerminalCommand(db, user, M1, "cd reports");
    await runTerminalCommand(db, user, M1, "chmod 600 incident_brief.txt");
    const cat = await runTerminalCommand(db, user, M1, "cat incident_brief.txt");
    expect(cat.cwd).toBe("/home/analyst/reports");
    expect(cat.output).toContain("CYBEROPS{permissions_are_a_lock_you_own}");

    const ok = (taskId: string, value: string, kind: "flag" | "text" = "flag") => submitAnswer(db, user, M1, taskId, { kind, value });
    expect((await ok("mentor-flag", "CYBEROPS{dotfiles_are_not_invisible}")).correct).toBe(true);
    expect((await ok("locked-report", "CYBEROPS{permissions_are_a_lock_you_own}")).xpAwarded).toBe(150);

    // Dependent objective is locked until its prerequisite is solved.
    await expect(ok("c2-domain", "beacon.update-cdn-sync.example", "text")).rejects.toThrow(/Complete first/);
    expect((await ok("suspicious-process", "/tmp/.X11-cache/sysupdate", "text")).correct).toBe(true);
    expect((await ok("c2-domain", "beacon.update-cdn-sync.example", "text")).correct).toBe(true);

    const done = await completeMission(db, user, M1);
    expect(done).toMatchObject({ firstCompletion: true, xpAwarded: 150, independent: true });
    expect(done.achievements).toEqual(expect.arrayContaining(["first-mission", "independent-operator"]));
    expect(await totalXp(db, user)).toBe(50 + 100 + 150 + 100 + 125 + 150);
  });

  it("cannot complete a mission with objectives remaining", async () => {
    await startMission(db, user, M2);
    await expect(completeMission(db, user, M2)).rejects.toThrow(/objective\(s\) remain/);
  });

  it("returns saved progress for a returning user", async () => {
    const m = (await getMission(db, M2))!;
    await startMission(db, user, M2);
    await submitAnswer(db, user, M2, "attacker-ip", { kind: "text", value: "10.0.0.1" });
    await submitAnswer(db, user, M2, "attacker-ip", { kind: "text", value: "203.0.113.45" });
    const p = await getMissionProgress(db, user, m);
    expect(p.attempt?.status).toBe("in_progress");
    expect(p.tasks["attacker-ip"]).toMatchObject({ solved: true, attempts: 1 });
    expect(p.tasks["breach-event"].solved).toBe(false);
  });
});

describe("anti-farming and integrity", () => {
  it("never awards XP twice for the same objective or mission", async () => {
    await startMission(db, user, M2);
    const first = await submitAnswer(db, user, M2, "attacker-ip", { kind: "text", value: "203.0.113.45" });
    const again = await submitAnswer(db, user, M2, "attacker-ip", { kind: "text", value: "203.0.113.45" });
    expect(first.xpAwarded).toBe(75);
    expect(again).toMatchObject({ alreadySolved: true, xpAwarded: 0 });

    // Concurrent duplicate submissions still award once.
    await Promise.all(
      Array.from({ length: 5 }, () => submitAnswer(db, user, M2, "technique", { kind: "choice", selected: ["spray"] })),
    );
    const ledger = await db.select().from(s.xpTransactions).where(eq(s.xpTransactions.userId, user));
    expect(ledger.filter((r) => r.sourceKey === `task:${M2}:technique`)).toHaveLength(1);
  });

  it("rejects a valid flag submitted to the wrong mission", async () => {
    await startMission(db, user, M3);
    const r = await submitAnswer(db, user, M3, "script-flag", { kind: "flag", value: "CYBEROPS{dotfiles_are_not_invisible}" }).catch((e) => e);
    // script-flag requires escalation-chain first, so it is blocked outright…
    expect(String(r)).toMatch(/Complete first/);
    // …and an unknown task id for this mission is rejected.
    await expect(submitAnswer(db, user, M3, "mentor-flag", { kind: "flag", value: "CYBEROPS{dotfiles_are_not_invisible}" })).rejects.toThrow(/Unknown objective/);
  });

  it("records every submission and counts wrong attempts", async () => {
    await startMission(db, user, M2);
    for (const v of ["1", "2", "3"]) await submitAnswer(db, user, M2, "attacker-ip", { kind: "text", value: v });
    const subs = await db.select().from(s.submissions).where(eq(s.submissions.userId, user));
    expect(subs).toHaveLength(3);
    expect(subs.every((x) => !x.correct)).toBe(true);
  });

  it("isolates terminal state between users", async () => {
    const other = await makeUser("Other");
    await startMission(db, user, M1);
    await startMission(db, other, M1);
    await runTerminalCommand(db, user, M1, "cd /tmp");
    const theirs = await runTerminalCommand(db, other, M1, "pwd");
    expect(theirs.output).toBe("/home/analyst\n");
  });
});

describe("hints", () => {
  it("reveals hints progressively, reduces XP, and gates the walkthrough", async () => {
    await startMission(db, user, M2);
    const views = [];
    for (let i = 0; i < 4; i++) views.push(await revealHint(db, user, M2, "attempt-count"));
    expect(views.map((v) => v.hints.length)).toEqual([1, 2, 3, 4]);
    expect(views[3].solution).toBeNull();

    // Every hint used, but not enough genuine attempts yet.
    await expect(revealHint(db, user, M2, "attempt-count")).rejects.toThrow(/walkthrough unlocks/);
    await submitAnswer(db, user, M2, "attacker-ip", { kind: "text", value: "203.0.113.45" });
    for (const v of ["1", "2", "3"]) await submitAnswer(db, user, M2, "attempt-count", { kind: "text", value: v });
    const sol = await revealHint(db, user, M2, "attempt-count");
    expect(sol.solution).toContain(String(ATTACKER_FAILURE_COUNT));
    expect(sol.solutionRevealed).toBe(true);

    const r = await submitAnswer(db, user, M2, "attempt-count", { kind: "text", value: String(ATTACKER_FAILURE_COUNT) });
    expect(r.xpAwarded).toBe(Math.round(75 * 0.25));
  });

  it("hint XP penalty applies to assisted solves", async () => {
    await startMission(db, user, M2);
    await revealHint(db, user, M2, "attacker-ip");
    await revealHint(db, user, M2, "attacker-ip");
    const r = await submitAnswer(db, user, M2, "attacker-ip", { kind: "text", value: "203.0.113.45" });
    expect(r.xpAwarded).toBe(60);
  });
});

describe("Mission 2 & 3 via the service", () => {
  it("evidence selection and dossier completion", async () => {
    await startMission(db, user, M2);
    const sub = (taskId: string, s: Parameters<typeof submitAnswer>[4]) => submitAnswer(db, user, M2, taskId, s);
    await sub("attacker-ip", { kind: "text", value: "203.0.113.45" });
    await sub("attempt-count", { kind: "text", value: String(ATTACKER_FAILURE_COUNT) });
    expect((await sub("breach-event", { kind: "evidence_select", rows: [ATTACK_SUCCESS_EVENT_ID] })).correct).toBe(true);
    await sub("compromised-account", { kind: "text", value: "MTorres" });
    await sub("technique", { kind: "choice", selected: ["spray"] });
    await sub("missing-control", { kind: "choice", selected: ["mfa"] });
    expect((await completeMission(db, user, M2)).firstCompletion).toBe(true);

    await startMission(db, user, M3);
    const m3 = (await getMission(db, M3))!;
    const s3 = (taskId: string, s: Parameters<typeof submitAnswer>[4]) => submitAnswer(db, user, M3, taskId, s);
    await s3("suspicious-auth", { kind: "evidence_select", rows: ["RA-2037"] });
    await s3("access-method", { kind: "choice", selected: ["stolen-creds"] });
    await s3("missing-control", { kind: "choice", selected: ["mfa-legacy"] });
    const order = m3.tasks.find((t) => t.id === "escalation-chain");
    await s3("escalation-chain", { kind: "ordering", order: order?.kind === "ordering" ? order.correctOrder : [] });
    await s3("script-flag", { kind: "flag", value: "CYBEROPS{plaintext_secrets_become_attacker_keys}" });
    await s3("exposed-systems", { kind: "choice", selected: ["vdi-legacy-03", "dc-01", "claims-db-01", "billing-app-02", "fs-01"] });
    await s3("containment", { kind: "choice", selected: ["disable-accounts", "rotate-svc", "close-portal", "isolate-preserve", "block-ips"] });
    const done = await completeMission(db, user, M3);
    expect(done.achievements).toContain("dossier-investigator");

    const summary = await userSummary(db, user);
    expect(summary.cards.filter((c) => c.status === "completed").map((c) => c.mission.id)).toEqual([M2, M3]);
    const ir = summary.skills.find((k) => k.skill === "incident_response")!;
    expect(ir.missions).toBe(2);
    expect(ir.levelIndex).toBeGreaterThanOrEqual(3); // Practitioner: medium evidence across 2 missions
  });
});

describe("progression views", () => {
  it("recommends the first mission for a new user and unlocks exploration", async () => {
    const cards = await missionCards(db, user);
    expect(cards.find((c) => c.recommended)?.mission.id).toBe(M1);
    expect(cards.every((c) => c.status === "available")).toBe(true);
  });

  it("hard prerequisites lock a mission until satisfied", async () => {
    const m = (await getMission(db, M3))!;
    const gated = { ...m, prerequisites: { missions: [M1], minRank: 2 } };
    const gaps = await prerequisiteGaps(db, user, gated);
    expect(gaps).toHaveLength(2);
  });

  it("skill mastery starts unrated", async () => {
    const skills = await skillMasteries(db, user);
    expect(skills.every((x) => x.level === "Unrated")).toBe(true);
  });
});
