"use client";
import { Rich } from "@/components/rich";
import { useId, useState } from "react";
import type { ClientTask, Submission, TaskProgress } from "./types";

const HINT_NAMES = ["Concept", "Direction", "Tool", "Approach"];

export function TaskCard({
  index,
  task,
  progress,
  feedback,
  blockedBy,
  selection,
  onSubmit,
  onHint,
  onOpenTool,
}: {
  index: number;
  task: ClientTask;
  progress?: TaskProgress;
  feedback?: { ok: boolean; text: string };
  blockedBy: string[];
  selection: string[];
  onSubmit: (s: Submission) => Promise<boolean>;
  onHint: () => Promise<void>;
  onOpenTool?: () => void;
}) {
  const [value, setValue] = useState("");
  const [choice, setChoice] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [hintBusy, setHintBusy] = useState(false);
  const headingId = useId();
  const solved = !!progress?.solved;
  const blocked = blockedBy.length > 0 && !solved;
  const hints = progress?.hints ?? [];
  const hintsLeft = task.hintCount - hints.length;
  // Mirrors canRevealSolution() on the server (which remains the authority).
  const canReveal = !solved && !progress?.solution && hintsLeft === 0 && (progress?.attempts ?? 0) >= 3;

  async function send(s: Submission) {
    setBusy(true);
    await onSubmit(s);
    setBusy(false);
  }

  return (
    <article
      aria-labelledby={headingId}
      className={`rounded-[6px] border p-4 ${solved ? "border-teal/40 bg-teal/[0.06]" : blocked ? "border-rule opacity-70" : "border-rule bg-panel"}`}
    >
      <header className="flex items-start justify-between gap-3">
        <h2 id={headingId} className="t-h3">
          <span className="text-faint font-normal mr-2">{index}</span>
          {task.title}
        </h2>
        <span className={`t-micro shrink-0 ${solved ? "text-teal" : "text-muted"}`}>{solved ? "Solved" : `${task.xp} XP`}</span>
      </header>
      <p className="t-small text-muted mt-1.5"><Rich text={task.prompt} /></p>

      {blocked ? (
        <p className="t-small text-faint mt-3">Unlocks after: {blockedBy.join(", ")}</p>
      ) : !solved ? (
        <div className="mt-3">
          {(task.kind === "flag" || task.kind === "text") && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (value.trim()) send({ kind: task.kind as "flag" | "text", value });
              }}
            >
              <label className="sr-only" htmlFor={`in-${task.id}`}>{task.kind === "flag" ? "Flag" : "Answer"}</label>
              <input
                id={`in-${task.id}`}
                className="field data flex-1 min-w-0"
                placeholder={task.kind === "flag" ? "CYBEROPS{...}" : task.placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <button className="btn btn-primary" disabled={busy || !value.trim()}>{busy ? "Checking" : "Submit"}</button>
            </form>
          )}

          {task.kind === "choice" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (choice.length) send({ kind: "choice", selected: choice });
              }}
            >
              <fieldset>
                <legend className="sr-only">{task.multi ? "Select all that apply" : "Choose one"}</legend>
                {task.multi && <p className="t-micro text-muted mb-2">Select all that apply.</p>}
                <div className="space-y-1.5">
                  {task.options!.map((o) => (
                    <label key={o.id} className={`flex gap-2.5 items-start p-2 rounded-[4px] cursor-pointer t-small ${choice.includes(o.id) ? "bg-raised" : "hover:bg-raised/60"}`}>
                      <input
                        type={task.multi ? "checkbox" : "radio"}
                        name={`opt-${task.id}`}
                        className="mt-1 accent-[var(--color-signal)]"
                        checked={choice.includes(o.id)}
                        onChange={() => setChoice((c) => (task.multi ? (c.includes(o.id) ? c.filter((x) => x !== o.id) : [...c, o.id]) : [o.id]))}
                      />
                      <span>{o.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button className="btn btn-primary mt-3" disabled={busy || !choice.length}>{busy ? "Checking" : "Submit"}</button>
            </form>
          )}

          {task.kind === "evidence_select" && (
            <div>
              <p className="t-small">
                {selection.length ? (
                  <>Marked: <span className="data">{selection.join(", ")}</span></>
                ) : (
                  <span className="text-muted">No rows marked yet.</span>
                )}
              </p>
              <p className="t-micro text-muted mt-1">Up to {task.maxSelections} row{task.maxSelections! > 1 ? "s" : ""}. Mark rows with the checkbox in the log viewer.</p>
              <div className="flex gap-2 mt-3">
                <button className="btn btn-quiet" onClick={onOpenTool}>Open log viewer</button>
                <button className="btn btn-primary" disabled={busy || !selection.length} onClick={() => send({ kind: "evidence_select", rows: selection })}>
                  {busy ? "Checking" : "Submit selection"}
                </button>
              </div>
            </div>
          )}

          {task.kind === "ordering" && (
            <button className="btn btn-quiet" onClick={onOpenTool}>Open timeline builder</button>
          )}

          {task.kind === "terminal_observation" && (
            <p className="t-small text-muted">
              Completes automatically when you do it in the{" "}
              <button className="link" onClick={onOpenTool}>terminal</button>.
            </p>
          )}
        </div>
      ) : null}

      {feedback && (
        <p role="status" className={`t-small mt-3 ${feedback.ok ? "text-teal" : "text-amber"}`}>{feedback.text}</p>
      )}

      {solved && progress?.explanation && <p className="t-small mt-3 prose-measure"><Rich text={progress.explanation} /></p>}

      {solved && (hints.length > 0 || progress?.solution) && (
        <details className="mt-3 pt-3 border-t border-rule/70">
          <summary className="t-small text-signal cursor-pointer">Review hints and walkthrough</summary>
          <ol className="space-y-2 mt-3">
            {hints.map((h, i) => (
              <li key={i} className="t-small"><span className="text-signal">{HINT_NAMES[i]} hint.</span> <Rich text={h} /></li>
            ))}
          </ol>
          {progress?.solution && <p className="t-small mt-3 p-3 rounded-[4px] bg-term border border-rule"><Rich text={progress.solution} /></p>}
        </details>
      )}

      {!blocked && !solved && (
        <div className="mt-3 pt-3 border-t border-rule/70">
          {hints.length > 0 && (
            <ol className="space-y-2 mb-3">
              {hints.map((h, i) => (
                <li key={i} className="t-small">
                  <span className="text-signal">{HINT_NAMES[i]} hint.</span> <Rich text={h} />
                </li>
              ))}
            </ol>
          )}
          {progress?.solution && (
            <div className="t-small mb-3 p-3 rounded-[4px] bg-term border border-rule">
              <p className="text-amber mb-1">Walkthrough (assisted completion)</p>
              <p><Rich text={progress.solution} /></p>
            </div>
          )}
          {!solved && (
            <div className="flex flex-wrap items-center gap-3">
              {hintsLeft > 0 ? (
                <button
                  className="t-small text-signal hover:underline disabled:opacity-50"
                  disabled={hintBusy}
                  onClick={async () => {
                    setHintBusy(true);
                    await onHint();
                    setHintBusy(false);
                  }}
                >
                  {hints.length ? "Next hint" : "Get a hint"}
                </button>
              ) : !progress?.solution ? (
                canReveal ? (
                  <button className="t-small text-amber hover:underline" onClick={() => onHint()}>Reveal full walkthrough</button>
                ) : (
                  <span className="t-micro text-muted">The walkthrough unlocks after a few more genuine attempts.</span>
                )
              ) : null}
              {hintsLeft > 0 && (
                <span className="t-micro text-muted">
                  {hintsLeft} left. Each hint reduces this objective&rsquo;s XP by 10%. Asking for help is part of learning.
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
