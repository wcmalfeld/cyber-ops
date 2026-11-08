/**
 * Deterministic answer validation. Runs only on the server (PRD §14.4).
 * Feedback never reveals the correct answer — it explains the *kind* of mistake.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { ObservationCondition, Task } from "./schema";
import type { TerminalState } from "./terminal/interpreter";
import { normalize } from "./terminal/vfs";

export const submissionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("flag"), value: z.string().max(200) }),
  z.object({ kind: z.literal("text"), value: z.string().max(300) }),
  z.object({ kind: z.literal("choice"), selected: z.array(z.string().max(64)).max(20) }),
  z.object({ kind: z.literal("evidence_select"), rows: z.array(z.string().max(64)).max(50) }),
  z.object({ kind: z.literal("ordering"), order: z.array(z.string().max(64)).max(30) }),
]);
export type Submission = z.infer<typeof submissionSchema>;

export interface ValidationResult {
  correct: boolean;
  message: string;
}

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

export function normalizeText(value: string, caseSensitive = false): string {
  let v = value.trim().replace(/\s+/g, " ").replace(/^["'`]+|["'`]+$/g, "");
  if (v.length > 1 && v.startsWith("/")) v = v.replace(/\/+$/, "");
  return caseSensitive ? v : v.toLowerCase();
}

export function validateSubmission(task: Task, sub: Submission): ValidationResult {
  if (task.kind === "terminal_observation")
    return { correct: false, message: "This objective completes automatically when you do it in the terminal." };
  if (sub.kind !== task.kind)
    return { correct: false, message: "That answer type does not match this objective." };

  switch (task.kind) {
    case "flag": {
      const v = (sub as { value: string }).value.trim();
      if (!/^CYBEROPS\{.+\}$/i.test(v))
        return { correct: false, message: "Flags look like CYBEROPS{...}. Copy the whole flag, braces included." };
      const hit = task.flags.some((f) => safeEqual(f, v));
      return hit
        ? { correct: true, message: "Flag accepted." }
        : { correct: false, message: "Well-formed, but not a flag for this objective." };
    }
    case "text": {
      const v = normalizeText((sub as { value: string }).value, task.caseSensitive);
      if (!v) return { correct: false, message: "Enter an answer first." };
      const hit = task.accept.some((a) => safeEqual(normalizeText(a, task.caseSensitive), v));
      if (hit) return { correct: true, message: "Correct." };
      const fb = task.feedback.find((f) => normalizeText(f.match, task.caseSensitive) === v);
      return { correct: false, message: fb?.message ?? "Not quite. Re-check the evidence." };
    }
    case "choice": {
      const selected = [...new Set((sub as { selected: string[] }).selected)];
      if (!selected.length) return { correct: false, message: "Select an answer first." };
      const valid = new Set(task.options.map((o) => o.id));
      if (selected.some((s) => !valid.has(s))) return { correct: false, message: "Unknown option." };
      if (!task.multi && selected.length !== 1)
        return { correct: false, message: "Choose exactly one option." };
      const correct = new Set(task.correct);
      const wrongPicks = selected.filter((s) => !correct.has(s));
      const missing = task.correct.filter((c) => !selected.includes(c));
      if (!wrongPicks.length && !missing.length) return { correct: true, message: "Correct." };
      if (!task.multi) {
        const opt = task.options.find((o) => o.id === selected[0]);
        return { correct: false, message: opt?.whyWrong ?? "That isn't supported by the evidence." };
      }
      // For multi-select, explain the first wrong pick (if it has a rationale) and
      // report how many are missing — without naming which.
      const firstWrong = task.options.find((o) => o.id === wrongPicks[0]);
      const parts: string[] = [];
      if (wrongPicks.length)
        parts.push(firstWrong?.whyWrong ? `One selection is a problem: ${firstWrong.whyWrong}` : `${wrongPicks.length} selection(s) aren't supported.`);
      if (missing.length) parts.push(`${missing.length} correct option(s) still unselected.`);
      return { correct: false, message: parts.join(" ") };
    }
    case "evidence_select": {
      const rows = [...new Set((sub as { rows: string[] }).rows)];
      if (!rows.length) return { correct: false, message: "Mark at least one row as evidence in the log viewer." };
      if (rows.length > task.maxSelections)
        return { correct: false, message: `Too broad — select at most ${task.maxSelections} row(s). Narrow it to the decisive events.` };
      const missing = task.required.filter((r) => !rows.includes(r));
      if (!missing.length) return { correct: true, message: "Evidence confirmed." };
      const found = task.required.length - missing.length;
      return {
        correct: false,
        message: found
          ? `Partially right: ${found} of ${task.required.length} key event(s) selected.`
          : "None of the selected rows are the decisive event(s). Look again at what changed.",
      };
    }
    case "ordering": {
      const order = (sub as { order: string[] }).order;
      if (order.length !== task.correctOrder.length || new Set(order).size !== order.length)
        return { correct: false, message: "Place every step exactly once." };
      let firstWrong = -1;
      for (let i = 0; i < order.length; i++)
        if (order[i] !== task.correctOrder[i]) {
          firstWrong = i;
          break;
        }
      if (firstWrong === -1) return { correct: true, message: "Sequence confirmed." };
      return {
        correct: false,
        message: `The first ${firstWrong} step(s) are in the right place; the sequence breaks after that. Check timestamps.`,
      };
    }
  }
}

export function isObserved(cond: ObservationCondition, observed: TerminalState["observed"]): boolean {
  switch (cond.type) {
    case "read_file":
      return observed.readFiles.includes(normalize(cond.path));
    case "listed_hidden":
      return observed.listedHidden.includes(normalize(cond.dir));
    case "used_command":
      return observed.commands.includes(cond.command);
  }
}
