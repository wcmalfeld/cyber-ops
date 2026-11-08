/**
 * Builds the only shape of a mission that ever leaves the server.
 *
 * This is an explicit allow-list, not "the definition minus some fields": a new field
 * added to the schema stays server-side until someone deliberately exposes it here.
 * Flags, accepted answers, correct options, correct orderings, required rows, hint
 * text, solutions, terminal file contents and the debrief are never included.
 */
import type { Mission, Task, TaskKind, ToolId } from "./schema";

export interface ClientTask {
  id: string;
  kind: TaskKind;
  title: string;
  prompt: string;
  xp: number;
  requires: string[];
  hintCount: number;
  placeholder?: string;
  multi?: boolean;
  options?: { id: string; label: string }[];
  items?: { id: string; label: string }[];
  evidenceId?: string;
  maxSelections?: number;
}

export interface ClientEvidenceMeta {
  id: string;
  name: string;
  format: "csv" | "log" | "json" | "txt";
  description: string;
  source: string;
  rowIdColumn?: string;
  timestampColumn?: string;
}

export interface ClientMission {
  id: string;
  version: number;
  title: string;
  codename: string;
  summary: string;
  category: Mission["category"];
  path: Mission["path"];
  difficulty: Mission["difficulty"];
  level: number;
  estimatedMinutes: number;
  learningObjectives: string[];
  briefing: Mission["briefing"];
  tools: ToolId[];
  terminal?: { user: string; hostname: string; home: string; motd?: string };
  evidence: ClientEvidenceMeta[];
  tasks: ClientTask[];
  completionXp: number;
  dossierId?: string;
  companyIds: string[];
  totalXp: number;
}

/** Deterministic shuffle (mulberry32 seeded from a string) that never returns the input order. */
export function stableShuffle<T>(items: T[], seed: string): T[] {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  let a = h >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.length > 1 && out.every((x, i) => x === items[i])) out.push(out.shift()!);
  return out;
}

function toClientTask(t: Task, missionId: string): ClientTask {
  const base: ClientTask = {
    id: t.id,
    kind: t.kind,
    title: t.title,
    prompt: t.prompt,
    xp: t.xp,
    requires: t.requires,
    hintCount: t.hints.length,
  };
  switch (t.kind) {
    case "text":
      return { ...base, placeholder: t.placeholder };
    case "choice":
      return { ...base, multi: t.multi, options: t.options.map(({ id, label }) => ({ id, label })) };
    case "ordering":
      return { ...base, items: stableShuffle(t.items, `${missionId}:${t.id}`).map(({ id, label }) => ({ id, label })) };
    case "evidence_select":
      return { ...base, evidenceId: t.evidenceId, maxSelections: t.maxSelections };
    default:
      return base;
  }
}

export function toClientMission(m: Mission): ClientMission {
  return {
    id: m.id,
    version: m.version,
    title: m.title,
    codename: m.codename,
    summary: m.summary,
    category: m.category,
    path: m.path,
    difficulty: m.difficulty,
    level: m.level,
    estimatedMinutes: m.estimatedMinutes,
    learningObjectives: m.learningObjectives,
    briefing: m.briefing,
    tools: m.tools,
    terminal: m.terminal
      ? { user: m.terminal.user, hostname: m.terminal.hostname, home: m.terminal.home, motd: m.terminal.motd }
      : undefined,
    evidence: m.evidence.map((e) => ({
      id: e.id,
      name: e.name,
      format: e.format,
      description: e.description,
      source: e.source,
      rowIdColumn: e.rowIdColumn,
      timestampColumn: e.timestampColumn,
    })),
    tasks: m.tasks.map((t) => toClientTask(t, m.id)),
    completionXp: m.completionXp,
    dossierId: m.dossierId,
    companyIds: m.companyIds,
    totalXp: m.completionXp + m.tasks.reduce((s, t) => s + t.xp, 0),
  };
}
