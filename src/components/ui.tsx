import Link from "next/link";
import type { Difficulty } from "@/engine/schema";
import type { MissionCard } from "@/server/profile";

const DIFF_LABEL: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard", very_hard: "Very hard", expert: "Expert" };
const DIFF_BARS: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, very_hard: 4, expert: 5 };

export function DifficultyMeter({ difficulty }: { difficulty: Difficulty }) {
  const n = DIFF_BARS[difficulty];
  return (
    <span className="inline-flex items-center gap-1.5 t-micro text-muted" aria-label={`Difficulty: ${DIFF_LABEL[difficulty]}`}>
      <span aria-hidden="true" className="inline-flex gap-[2px]">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`w-1 h-3 rounded-[1px] ${i <= n ? "bg-amber" : "bg-rule"}`} />
        ))}
      </span>
      {DIFF_LABEL[difficulty]}
    </span>
  );
}

const STATUS: Record<MissionCard["status"], { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "text-teal border-teal/40" },
  in_progress: { label: "In progress", cls: "text-signal border-signal/40" },
  available: { label: "Available", cls: "text-muted border-rule" },
  locked: { label: "Locked", cls: "text-faint border-rule" },
};

export function StatusPill({ status, recommended }: { status: MissionCard["status"]; recommended?: boolean }) {
  const s = STATUS[status];
  return (
    <span className="inline-flex gap-1.5">
      {recommended && <span className="t-micro px-1.5 py-0.5 rounded-[3px] bg-teal/15 text-teal">Recommended</span>}
      <span className={`t-micro px-1.5 py-0.5 rounded-[3px] border ${s.cls}`}>{s.label}</span>
    </span>
  );
}

export function Meter({ value, label, tone = "teal" }: { value: number; label: string; tone?: "teal" | "signal" }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-1.5 bg-rule rounded-full overflow-hidden">
      <div className={`h-full ${tone === "teal" ? "bg-teal" : "bg-signal"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function MissionRow({ card }: { card: MissionCard }) {
  const m = card.mission;
  const locked = card.status === "locked";
  return (
    <li className="border-b border-rule last:border-0">
      <div className="py-3.5 grid gap-1 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {locked ? <span className="font-medium text-faint">{m.title}</span> : <Link href={`/missions/${m.id}`} className="font-medium hover:text-signal">{m.title}</Link>}
            <span className="data text-faint">{m.codename}</span>
          </div>
          <p className="t-small text-muted mt-0.5 prose-measure">{locked ? card.lockedReasons.join("; ") : m.summary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <DifficultyMeter difficulty={m.difficulty} />
          <span className="t-micro text-muted">{card.solvedTasks}/{m.tasks.length} objectives</span>
          <StatusPill status={card.status} recommended={card.recommended} />
        </div>
      </div>
    </li>
  );
}

export function PageHeader({ title, intro, children }: { title: string; intro?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="prose-measure">
        <h1 className="t-h1">{title}</h1>
        {intro && <p className="text-muted mt-2">{intro}</p>}
      </div>
      {children}
    </header>
  );
}

/** Marks features that are planned rather than built — PRD §21 rule 10. */
export function Planned({ phase, children }: { phase: string; children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-rule rounded-[6px] p-4 t-small text-muted">
      <span className="text-amber font-medium">Planned for {phase}.</span> {children}
    </div>
  );
}
