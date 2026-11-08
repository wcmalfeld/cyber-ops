/**
 * Mission definition schema — the contract between authored content and the engine.
 *
 * Every mission is plain data validated by this schema. The engine never special-cases
 * a mission by id: tools, evidence, tasks, validation rules, hints, XP, skills and the
 * debrief are all declared here. Add a mission by adding a definition, not a page.
 */
import { z } from "zod";

export const DIFFICULTIES = ["easy", "medium", "hard", "very_hard", "expert"] as const;
export const difficultySchema = z.enum(DIFFICULTIES);
export type Difficulty = z.infer<typeof difficultySchema>;

export const CATEGORIES = [
  "linux",
  "networking",
  "cryptography",
  "forensics",
  "soc",
  "web",
  "identity",
  "cloud",
  "endpoint",
  "supply_chain",
] as const;
export const categorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof categorySchema>;

/** The six specializations from PRD §4. */
export const PATHS = ["soc", "red_team", "dfir", "cloud_identity", "appsec", "endpoint"] as const;
export const pathSchema = z.enum(PATHS);
export type PathId = z.infer<typeof pathSchema>;

export const SKILLS = [
  "networking",
  "linux",
  "windows",
  "programming",
  "cryptography",
  "application_security",
  "web_security",
  "cloud_security",
  "identity_management",
  "digital_forensics",
  "incident_response",
  "threat_hunting",
  "vulnerability_management",
  "endpoint_security",
] as const;
export const skillSchema = z.enum(SKILLS);
export type SkillId = z.infer<typeof skillSchema>;

export const TOOLS = ["terminal", "evidence_viewer", "log_viewer", "timeline_builder"] as const;
export const toolSchema = z.enum(TOOLS);
export type ToolId = z.infer<typeof toolSchema>;

/** PostgreSQL JSONB cannot store NUL; reject it at authoring time instead of at seed time. */
const contentSchema = z.string().refine((v) => !v.includes("\u0000"), "content must not contain NUL (\\u0000) characters");

const idSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, "ids are lowercase slugs");

// ── Simulated environment ──────────────────────────────────────────────────

export const vfsFileSchema = z.object({
  path: z.string().startsWith("/"),
  content: contentSchema,
  /** Octal permission bits, e.g. 0o644. */
  mode: z.number().int().min(0).max(0o777).default(0o644),
  owner: z.string().default("root"),
  group: z.string().default("root"),
  /** ISO timestamp shown by ls -l / stat. */
  mtime: z.string().default("2026-10-01T09:00:00Z"),
  /** Binary files print a warning under cat; `strings` extracts printable runs. */
  binary: z.boolean().default(false),
  /** Description returned by the `file` command. */
  fileType: z.string().optional(),
});

export const vfsDirSchema = z.object({
  path: z.string().startsWith("/"),
  mode: z.number().int().min(0).max(0o777).default(0o755),
  owner: z.string().default("root"),
  group: z.string().default("root"),
  mtime: z.string().default("2026-10-01T09:00:00Z"),
});

export const processSchema = z.object({
  pid: z.number().int(),
  user: z.string(),
  command: z.string(),
  cpu: z.number().default(0),
  mem: z.number().default(0.1),
  start: z.string().default("09:00"),
});

export const OPTIONAL_COMMANDS = ["base64", "wc", "sort", "uniq", "echo"] as const;

export const terminalEnvSchema = z.object({
  user: z.string(),
  uid: z.number().int(),
  groups: z.array(z.string()).min(1),
  hostname: z.string(),
  home: z.string().startsWith("/"),
  cwd: z.string().startsWith("/"),
  dirs: z.array(vfsDirSchema).default([]),
  files: z.array(vfsFileSchema),
  processes: z.array(processSchema).default([]),
  /** Seeded into `history` so beginners can learn from a previous operator. */
  history: z.array(z.string()).default([]),
  /** Commands beyond the core set that this mission enables. */
  extraCommands: z.array(z.enum(OPTIONAL_COMMANDS)).default([]),
  motd: z.string().optional(),
});
export type TerminalEnv = z.infer<typeof terminalEnvSchema>;

// ── Evidence ───────────────────────────────────────────────────────────────

export const evidenceSchema = z.object({
  id: idSchema,
  name: z.string(),
  format: z.enum(["csv", "log", "json", "txt"]),
  description: z.string(),
  content: contentSchema,
  /** For CSV evidence: the column that uniquely identifies each row. */
  rowIdColumn: z.string().optional(),
  /** Column containing timestamps, enabling timestamp inspection/sorting. */
  timestampColumn: z.string().optional(),
  source: z.string().describe("Fictional system that produced this artifact"),
});
export type Evidence = z.infer<typeof evidenceSchema>;

// ── Tasks (objectives) ─────────────────────────────────────────────────────

const skillWeightSchema = z.object({ skill: skillSchema, weight: z.number().positive().max(3) });

const taskBase = {
  id: idSchema,
  title: z.string(),
  prompt: z.string(),
  xp: z.number().int().positive(),
  skills: z.array(skillWeightSchema).min(1),
  /** Progressive hints: conceptual nudge → direction → tool → approach. */
  hints: z.array(z.string()).length(4),
  /** Full walkthrough, revealed only after a learning condition (see engine/hints.ts). */
  solution: z.string(),
  /** Explanation shown once the task is solved. */
  explanation: z.string(),
  /** Task ids that must be solved first (flags that unlock subsequent tasks). */
  requires: z.array(idSchema).default([]),
};

export const flagTaskSchema = z.object({
  ...taskBase,
  kind: z.literal("flag"),
  flags: z.array(z.string().regex(/^CYBEROPS\{[A-Za-z0-9_\-]+\}$/)).min(1),
});

export const textTaskSchema = z.object({
  ...taskBase,
  kind: z.literal("text"),
  placeholder: z.string().optional(),
  accept: z.array(z.string()).min(1),
  caseSensitive: z.boolean().default(false),
  /** Targeted feedback for predictable wrong answers. Never reveals the answer. */
  feedback: z.array(z.object({ match: z.string(), message: z.string() })).default([]),
});

export const choiceTaskSchema = z.object({
  ...taskBase,
  kind: z.literal("choice"),
  multi: z.boolean().default(false),
  options: z
    .array(z.object({ id: idSchema, label: z.string(), whyWrong: z.string().optional() }))
    .min(2),
  correct: z.array(idSchema).min(1),
});

export const evidenceSelectTaskSchema = z.object({
  ...taskBase,
  kind: z.literal("evidence_select"),
  evidenceId: idSchema,
  /** Row ids that must all be selected. */
  required: z.array(z.string()).min(1),
  maxSelections: z.number().int().positive(),
});

export const orderingTaskSchema = z.object({
  ...taskBase,
  kind: z.literal("ordering"),
  items: z.array(z.object({ id: idSchema, label: z.string() })).min(3),
  correctOrder: z.array(idSchema).min(3),
});

export const observationConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("read_file"), path: z.string() }),
  z.object({ type: z.literal("listed_hidden"), dir: z.string() }),
  z.object({ type: z.literal("used_command"), command: z.string() }),
]);
export type ObservationCondition = z.infer<typeof observationConditionSchema>;

/** Solved automatically when the server observes the condition in the terminal session. */
export const observationTaskSchema = z.object({
  ...taskBase,
  kind: z.literal("terminal_observation"),
  condition: observationConditionSchema,
});

export const taskSchema = z.discriminatedUnion("kind", [
  flagTaskSchema,
  textTaskSchema,
  choiceTaskSchema,
  evidenceSelectTaskSchema,
  orderingTaskSchema,
  observationTaskSchema,
]);
export type Task = z.infer<typeof taskSchema>;
export type TaskKind = Task["kind"];

// ── Briefing & debrief ─────────────────────────────────────────────────────

export const referenceSchema = z.object({
  title: z.string(),
  publisher: z.string(),
  url: z.string().url(),
});
export type Reference = z.infer<typeof referenceSchema>;

export const debriefSchema = z.object({
  summary: z.string(),
  whatHappened: z.string(),
  whyPossible: z.string(),
  technicalExplanation: z.string(),
  toolsUsed: z.array(z.object({ name: z.string(), purpose: z.string() })),
  techniques: z.array(z.object({ id: z.string(), name: z.string(), url: z.string().url().optional() })),
  concepts: z.array(z.object({ term: z.string(), definition: z.string() })),
  defenses: z.array(z.string()),
  commonMistakes: z.array(z.string()),
  resources: z.array(referenceSchema),
});
export type Debrief = z.infer<typeof debriefSchema>;

export const missionSchema = z
  .object({
    id: idSchema,
    version: z.number().int().positive(),
    title: z.string(),
    codename: z.string(),
    summary: z.string(),
    category: categorySchema,
    path: pathSchema,
    difficulty: difficultySchema,
    /** Training level 0–5 (PRD §3.2). */
    level: z.number().int().min(0).max(5),
    estimatedMinutes: z.number().int().positive(),
    learningObjectives: z.array(z.string()).min(1),
    prerequisites: z
      .object({
        missions: z.array(idSchema).default([]),
        minRank: z.number().int().min(0).default(0),
      })
      .default({ missions: [], minRank: 0 }),
    /** Soft guidance only — never blocks exploration. */
    recommendedAfter: z.array(idSchema).default([]),
    companyIds: z.array(idSchema).default([]),
    dossierId: idSchema.optional(),
    briefing: z.object({
      organization: z.string(),
      role: z.string(),
      situation: z.array(z.string()).min(1),
      glossary: z.array(z.object({ term: z.string(), definition: z.string() })).default([]),
    }),
    tools: z.array(toolSchema).min(1),
    terminal: terminalEnvSchema.optional(),
    evidence: z.array(evidenceSchema).default([]),
    tasks: z.array(taskSchema).min(1),
    completionXp: z.number().int().nonnegative(),
    debrief: debriefSchema,
    references: z.array(referenceSchema).default([]),
  })
  .superRefine((m, ctx) => {
    const taskIds = new Set<string>();
    for (const t of m.tasks) {
      if (taskIds.has(t.id)) ctx.addIssue({ code: "custom", message: `duplicate task id ${t.id}` });
      taskIds.add(t.id);
    }
    for (const t of m.tasks) {
      for (const r of t.requires)
        if (!taskIds.has(r)) ctx.addIssue({ code: "custom", message: `${t.id} requires unknown ${r}` });
      if (t.kind === "choice") {
        const opts = new Set(t.options.map((o) => o.id));
        for (const c of t.correct)
          if (!opts.has(c)) ctx.addIssue({ code: "custom", message: `${t.id}: unknown correct option ${c}` });
        if (!t.multi && t.correct.length !== 1)
          ctx.addIssue({ code: "custom", message: `${t.id}: single-choice needs exactly one answer` });
      }
      if (t.kind === "ordering") {
        const items = new Set(t.items.map((i) => i.id));
        if (t.correctOrder.length !== items.size || !t.correctOrder.every((i) => items.has(i)))
          ctx.addIssue({ code: "custom", message: `${t.id}: correctOrder must be a permutation of items` });
      }
      if (t.kind === "evidence_select") {
        if (!m.evidence.some((e) => e.id === t.evidenceId && e.rowIdColumn))
          ctx.addIssue({ code: "custom", message: `${t.id}: evidence ${t.evidenceId} needs rowIdColumn` });
        if (t.required.length > t.maxSelections)
          ctx.addIssue({ code: "custom", message: `${t.id}: maxSelections < required` });
      }
      if (t.kind === "terminal_observation" && !m.terminal)
        ctx.addIssue({ code: "custom", message: `${t.id}: observation task needs a terminal env` });
    }
    if (m.terminal && !m.tools.includes("terminal"))
      ctx.addIssue({ code: "custom", message: "terminal env declared but terminal tool not enabled" });
    if (m.evidence.length && !m.tools.some((t) => t === "evidence_viewer" || t === "log_viewer"))
      ctx.addIssue({ code: "custom", message: "evidence declared but no viewer tool enabled" });
  });

export type MissionInput = z.input<typeof missionSchema>;
export type Mission = z.infer<typeof missionSchema>;
