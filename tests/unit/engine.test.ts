import { describe, expect, it } from "vitest";
import { loadAuthoredMissions } from "@/content/missions";
import { ATTACKER_FAILURE_COUNT, ATTACK_SUCCESS_EVENT_ID, SPRAY_ORDER_BEFORE_SUCCESS } from "@/content/missions/who-logged-in";
import { toClientMission } from "@/engine/client-view";
import {
  awardedTaskXp,
  canRevealSolution,
  computeMastery,
  rankFor,
  type SkillEvidence,
} from "@/engine/progression";
import { missionSchema, type Task } from "@/engine/schema";
import { normalizeText, validateSubmission } from "@/engine/validate";
import { parseCsv } from "@/lib/csv";

const missions = loadAuthoredMissions();
const byId = (id: string) => missions.find((m) => m.id === id)!;
const task = (mid: string, tid: string) => byId(mid).tasks.find((t) => t.id === tid)! as Task;

describe("mission definitions", () => {
  it("all authored missions validate", () => {
    expect(missions.map((m) => m.id)).toEqual(["hidden-in-plain-sight", "who-logged-in", "the-unlocked-door"]);
  });

  it("the three initial missions use meaningfully different interaction patterns", () => {
    const kinds = missions.map((m) => new Set(m.tasks.map((t) => t.kind)));
    const tools = missions.map((m) => m.tools.join(","));
    expect(new Set(tools).size).toBe(3);
    expect(kinds[0].has("terminal_observation")).toBe(true);
    expect(kinds[1].has("evidence_select")).toBe(true);
    expect(kinds[2].has("ordering")).toBe(true);
  });

  it("rejects structurally broken definitions", () => {
    const base = structuredClone(missions[1]) as Record<string, unknown> & { tasks: Task[] };
    const bad = { ...base, tasks: [...base.tasks, { ...base.tasks[0] }] };
    expect(missionSchema.safeParse(bad).success).toBe(false); // duplicate task id
    const badReq = { ...base, tasks: [{ ...base.tasks[0], requires: ["nope"] }] };
    expect(missionSchema.safeParse(badReq).success).toBe(false);
  });

  it("Mission 2 answers are consistent with the generated log", () => {
    const ev = byId("who-logged-in").evidence[0];
    const { rows } = parseCsv(ev.content);
    const attacker = rows.filter((r) => r.src_ip === "203.0.113.45");
    expect(attacker.filter((r) => r.result === "FAILURE")).toHaveLength(ATTACKER_FAILURE_COUNT);
    const firstSuccess = attacker.find((r) => r.result === "SUCCESS")!;
    expect(firstSuccess.event_id).toBe(ATTACK_SUCCESS_EVENT_ID);
    expect(firstSuccess.user).toBe("mtorres");
    // Every username targeted before the success got exactly one attempt (spraying, not brute force).
    const before = attacker.filter((r) => r.timestamp < firstSuccess.timestamp);
    expect(before.map((r) => r.user)).toEqual(SPRAY_ORDER_BEFORE_SUCCESS);
  });

  it("Mission 3 timeline answer matches evidence timestamps", () => {
    const m = byId("the-unlocked-door");
    const de = parseCsv(m.evidence.find((e) => e.id === "directory-events")!.content).rows;
    const at = (id: string) => de.find((r) => r.event_id === id)!.timestamp;
    const seq = ["DE-5106", "DE-5108", "DE-5109", "DE-5110", "DE-5112"].map(at);
    expect([...seq].sort()).toEqual(seq);
  });
});

describe("client view never leaks answers", () => {
  for (const m of missions) {
    it(`${m.id}`, () => {
      const json = JSON.stringify(toClientMission(m));
      const secrets: string[] = [];
      for (const t of m.tasks) {
        secrets.push(t.solution, ...t.hints, t.explanation);
        if (t.kind === "flag") secrets.push(...t.flags);
        if (t.kind === "text") secrets.push(...t.accept.filter((a) => a.length > 3));
        if (t.kind === "evidence_select") secrets.push(...t.required.map((r) => `"${r}"`));
        if (t.kind === "choice") for (const o of t.options) if (o.whyWrong) secrets.push(o.whyWrong);
      }
      secrets.push(m.debrief.whatHappened, m.debrief.whyPossible);
      for (const f of m.terminal?.files ?? []) if (f.content.length > 20) secrets.push(f.content);
      for (const e of m.evidence) secrets.push(e.content);
      for (const sec of secrets) expect(json, `leaked: ${sec.slice(0, 60)}`).not.toContain(sec);
    });
  }

  it("ordering items are not shipped in the correct order", () => {
    const t = task("the-unlocked-door", "escalation-chain");
    const client = toClientMission(byId("the-unlocked-door")).tasks.find((x) => x.id === t.id)!;
    expect(client.items!.map((i) => i.id)).not.toEqual(t.kind === "ordering" ? t.correctOrder : []);
    expect(new Set(client.items!.map((i) => i.id)).size).toBe(7);
  });
});

describe("validation", () => {
  it("flags: exact match, helpful format feedback", () => {
    const t = task("hidden-in-plain-sight", "mentor-flag");
    expect(validateSubmission(t, { kind: "flag", value: "  CYBEROPS{dotfiles_are_not_invisible} " }).correct).toBe(true);
    expect(validateSubmission(t, { kind: "flag", value: "dotfiles_are_not_invisible" }).message).toMatch(/CYBEROPS\{/);
    // A real flag from a different objective is rejected.
    expect(validateSubmission(t, { kind: "flag", value: "CYBEROPS{permissions_are_a_lock_you_own}" }).correct).toBe(false);
  });

  it("text: normalization and targeted feedback without revealing the answer", () => {
    const t = task("hidden-in-plain-sight", "suspicious-process");
    expect(validateSubmission(t, { kind: "text", value: "/tmp/.X11-cache/sysupdate/" }).correct).toBe(true);
    const wrong = validateSubmission(t, { kind: "text", value: "sysupdate" });
    expect(wrong.correct).toBe(false);
    expect(wrong.message).not.toContain("/tmp/.X11-cache/sysupdate");
    expect(normalizeText("  Hello   World ")).toBe("hello world");
  });

  it("choice: single and multi-select", () => {
    const single = task("who-logged-in", "technique");
    expect(validateSubmission(single, { kind: "choice", selected: ["spray"] }).correct).toBe(true);
    expect(validateSubmission(single, { kind: "choice", selected: ["brute"] }).message).toMatch(/one account/);
    expect(validateSubmission(single, { kind: "choice", selected: ["spray", "brute"] }).correct).toBe(false);

    const multi = task("the-unlocked-door", "exposed-systems");
    const all = ["vdi-legacy-03", "dc-01", "claims-db-01", "billing-app-02", "fs-01"];
    expect(validateSubmission(multi, { kind: "choice", selected: all }).correct).toBe(true);
    expect(validateSubmission(multi, { kind: "choice", selected: all.slice(1) }).message).toMatch(/1 correct option/);
    expect(validateSubmission(multi, { kind: "choice", selected: [...all, "mail-01"] }).correct).toBe(false);
    expect(validateSubmission(multi, { kind: "choice", selected: ["not-an-option"] }).correct).toBe(false);
  });

  it("evidence selection: required rows, bounded selection size", () => {
    const t = task("who-logged-in", "breach-event");
    expect(validateSubmission(t, { kind: "evidence_select", rows: [ATTACK_SUCCESS_EVENT_ID] }).correct).toBe(true);
    expect(validateSubmission(t, { kind: "evidence_select", rows: ["EVT-1000", "EVT-1001", ATTACK_SUCCESS_EVENT_ID] }).message).toMatch(/at most 2/);
    expect(validateSubmission(t, { kind: "evidence_select", rows: ["EVT-1000"] }).correct).toBe(false);
  });

  it("ordering: exact permutation required", () => {
    const t = task("the-unlocked-door", "escalation-chain");
    if (t.kind !== "ordering") throw new Error();
    expect(validateSubmission(t, { kind: "ordering", order: t.correctOrder }).correct).toBe(true);
    const swapped = [...t.correctOrder];
    [swapped[3], swapped[4]] = [swapped[4], swapped[3]];
    expect(validateSubmission(t, { kind: "ordering", order: swapped }).message).toMatch(/first 3 step/);
    expect(validateSubmission(t, { kind: "ordering", order: t.correctOrder.slice(1) }).correct).toBe(false);
  });

  it("rejects mismatched submission kinds and observation submissions", () => {
    expect(validateSubmission(task("who-logged-in", "technique"), { kind: "text", value: "spray" }).correct).toBe(false);
    expect(validateSubmission(task("hidden-in-plain-sight", "reveal-hidden"), { kind: "text", value: "x" }).correct).toBe(false);
  });
});

describe("progression", () => {
  it("ranks by XP", () => {
    expect(rankFor(0).name).toBe("Recruit");
    expect(rankFor(299).name).toBe("Recruit");
    expect(rankFor(300).name).toBe("Junior Analyst");
    expect(rankFor(9000).next).toBeNull();
    expect(rankFor(650).progress).toBeCloseTo(0.5);
  });

  it("assisted completion earns less XP but never zero", () => {
    expect(awardedTaskXp(100, { hintsUsed: 0, solutionRevealed: false })).toBe(100);
    expect(awardedTaskXp(100, { hintsUsed: 2, solutionRevealed: false })).toBe(80);
    expect(awardedTaskXp(100, { hintsUsed: 4, solutionRevealed: false })).toBe(60);
    expect(awardedTaskXp(100, { hintsUsed: 4, solutionRevealed: true })).toBe(25);
  });

  it("solution unlocks only after the learning condition", () => {
    expect(canRevealSolution({ solved: false, attempts: 5, hintsUsed: 3, solutionRevealed: false })).toBe(false);
    expect(canRevealSolution({ solved: false, attempts: 2, hintsUsed: 4, solutionRevealed: false })).toBe(false);
    expect(canRevealSolution({ solved: false, attempts: 3, hintsUsed: 4, solutionRevealed: false })).toBe(true);
    expect(canRevealSolution({ solved: true, attempts: 0, hintsUsed: 0, solutionRevealed: false })).toBe(true);
  });

  it("ten easy Linux tasks do not make someone advanced", () => {
    const ev: SkillEvidence[] = Array.from({ length: 10 }, (_, i) => ({
      skill: "linux",
      weight: 1.5,
      missionId: `easy-${i}`,
      difficulty: "easy",
      attempts: 0,
      hintsUsed: 0,
      solutionRevealed: false,
    }));
    const m = computeMastery("linux", ev);
    expect(m.score).toBe(15);
    expect(m.level).toBe("Apprentice"); // score qualifies for Practitioner, but no medium+ evidence
    expect(m.nextRequirement).toMatch(/medium\+/);
  });

  it("mastery requires breadth across missions", () => {
    const ev: SkillEvidence[] = Array.from({ length: 6 }, () => ({
      skill: "incident_response",
      weight: 2,
      missionId: "one-mission",
      difficulty: "hard",
      attempts: 0,
      hintsUsed: 0,
      solutionRevealed: false,
    }));
    const m = computeMastery("incident_response", ev);
    expect(m.score).toBe(42);
    expect(m.level).toBe("Apprentice");
    expect(m.nextRequirement).toMatch(/1 more mission/);
  });

  it("revealed solutions count far less than independent work", () => {
    const base = { skill: "linux" as const, weight: 1, missionId: "m", difficulty: "medium" as const, attempts: 0, hintsUsed: 0 };
    const independent = computeMastery("linux", [{ ...base, solutionRevealed: false }]);
    const assisted = computeMastery("linux", [{ ...base, solutionRevealed: true, hintsUsed: 4 }]);
    expect(assisted.score).toBeLessThan(independent.score / 2);
    expect(assisted.hardestDifficulty).toBeNull();
  });
});
