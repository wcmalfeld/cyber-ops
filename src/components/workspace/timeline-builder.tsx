"use client";
import { useState } from "react";
import type { ClientTask, TaskProgress } from "./types";

/** Keyboard-accessible ordering board for reconstructing attack sequences. */
function Board({ task, solved, feedback, onSubmit }: { task: ClientTask; solved: boolean; feedback?: { ok: boolean; text: string }; onSubmit: (order: string[]) => Promise<boolean> }) {
  const [items, setItems] = useState(task.items ?? []);
  const [busy, setBusy] = useState(false);
  const [moved, setMoved] = useState<string>("");

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
    setMoved(`${next[j].label} moved to position ${j + 1} of ${next.length}.`);
  };

  return (
    <section aria-labelledby={`tl-${task.id}`} className="p-5">
      <h2 id={`tl-${task.id}`} className="t-h3">{task.title}</h2>
      <p className="t-small text-muted mt-1 prose-measure">{task.prompt}</p>
      <div aria-live="polite" className="sr-only">{moved}</div>
      <ol className="mt-4 space-y-2 relative">
        {items.map((it, i) => (
          <li key={it.id} className="flex items-stretch gap-3">
            <span className="flex flex-col items-center pt-2.5" aria-hidden="true">
              <span className={`size-2.5 rounded-full ${solved ? "bg-teal" : "bg-signal"}`} />
              {i < items.length - 1 && <span className="w-px flex-1 bg-rule mt-1" />}
            </span>
            <div className="flex-1 flex items-center justify-between gap-3 bg-raised border border-rule rounded-[4px] px-3 py-2">
              <span className="t-small"><span className="text-faint mr-2">{i + 1}</span>{it.label}</span>
              {!solved && (
                <span className="flex gap-1 shrink-0">
                  <button className="btn btn-quiet px-2 py-1" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move "${it.label}" earlier`}>Up</button>
                  <button className="btn btn-quiet px-2 py-1" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move "${it.label}" later`}>Down</button>
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
      {!solved && (
        <button
          className="btn btn-primary mt-4"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onSubmit(items.map((x) => x.id));
            setBusy(false);
          }}
        >
          {busy ? "Checking" : "Submit sequence"}
        </button>
      )}
      {feedback && <p role="status" className={`t-small mt-3 ${feedback.ok ? "text-teal" : "text-amber"}`}>{feedback.text}</p>}
    </section>
  );
}

export function TimelineBuilder({
  tasks,
  progress,
  feedback,
  onSubmit,
}: {
  tasks: ClientTask[];
  progress: Record<string, TaskProgress>;
  feedback: Record<string, { ok: boolean; text: string }>;
  onSubmit: (taskId: string, order: string[]) => Promise<boolean>;
}) {
  if (!tasks.length) return <p className="p-4 t-small text-muted">No timeline objectives in this mission.</p>;
  return (
    <div className="flex-1 overflow-y-auto scroll-thin">
      {tasks.map((t) => {
        const blocked = t.requires.some((r) => !progress[r]?.solved);
        // Solved in an earlier session: the client never holds the correct order, so show the walkthrough instead.
        if (progress[t.id]?.solved && !feedback[t.id]?.ok)
          return (
            <section key={t.id} className="p-5">
              <h2 className="t-h3">{t.title}</h2>
              <p className="t-small text-teal mt-1">Sequence confirmed.</p>
              {progress[t.id]?.solution && <p className="t-small mt-3 prose-measure">{progress[t.id]!.solution}</p>}
            </section>
          );
        return blocked ? (
          <p key={t.id} className="p-5 t-small text-muted">&ldquo;{t.title}&rdquo; unlocks after its earlier objectives are solved.</p>
        ) : (
          <Board key={t.id} task={t} solved={!!progress[t.id]?.solved} feedback={feedback[t.id]} onSubmit={(o) => onSubmit(t.id, o)} />
        );
      })}
    </div>
  );
}
