"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { EvidenceViewer } from "./evidence-viewer";
import { LogViewer } from "./log-viewer";
import { TaskCard } from "./task-card";
import { Terminal } from "./terminal";
import { TimelineBuilder } from "./timeline-builder";
import type { ClientMission, EvidenceFile, Submission, SubmitResult, TaskProgress } from "./types";

type ToolTab = "terminal" | "logs" | "evidence" | "timeline";

const TAB_LABEL: Record<ToolTab, string> = { terminal: "Terminal", logs: "Log viewer", evidence: "Evidence", timeline: "Timeline" };

export function Workspace({
  mission,
  initialProgress,
  completed: initiallyCompleted,
  terminal,
}: {
  mission: ClientMission;
  initialProgress: Record<string, TaskProgress>;
  completed: boolean;
  terminal: { cwd: string; history: string[] } | null;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState(initialProgress);
  const [feedback, setFeedback] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [announce, setAnnounce] = useState("");
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [evidenceCache, setEvidenceCache] = useState<Record<string, EvidenceFile>>({});
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(initiallyCompleted);

  const tabs = useMemo(() => {
    const t: ToolTab[] = [];
    if (mission.tools.includes("terminal")) t.push("terminal");
    if (mission.tools.includes("log_viewer") && mission.evidence.some((e) => e.format === "csv")) t.push("logs");
    if (mission.tools.includes("evidence_viewer") || mission.evidence.some((e) => e.format !== "csv")) if (mission.evidence.length) t.push("evidence");
    if (mission.tools.includes("timeline_builder")) t.push("timeline");
    return t;
  }, [mission]);
  const [tab, setTab] = useState<ToolTab>(tabs[0]);
  const [logFocus, setLogFocus] = useState<string | undefined>(undefined);

  const solvedCount = mission.tasks.filter((t) => progress[t.id]?.solved).length;
  const allSolved = solvedCount === mission.tasks.length;

  const markSolved = useCallback((taskId: string, xp: number, explanation: string | null, message: string) => {
    setProgress((p) => ({
      ...p,
      [taskId]: { ...p[taskId], solved: true, explanation, canRevealSolution: false },
    }));
    setFeedback((f) => ({ ...f, [taskId]: { ok: true, text: `${message}${xp ? ` +${xp} XP` : ""}` } }));
    const title = mission.tasks.find((t) => t.id === taskId)?.title ?? "Objective";
    setAnnounce(`${title} complete.${xp ? ` ${xp} XP earned.` : ""}`);
    // A solved task's hint endpoint returns its full review view (all hints + walkthrough) without scoring effects.
    api<TaskProgress>(`/api/missions/${mission.id}/tasks/${taskId}/hint`)
      .then((view) => setProgress((p) => ({ ...p, [taskId]: view })))
      .catch(() => {});
    router.refresh(); // update XP in the sidebar
  }, [mission.id, mission.tasks, router]);

  const submit = useCallback(
    async (taskId: string, submission: Submission) => {
      try {
        const r = await api<SubmitResult>(`/api/missions/${mission.id}/tasks/${taskId}/submit`, submission);
        if (r.correct) {
          markSolved(taskId, r.xpAwarded, r.explanation, r.message);
        } else {
          setProgress((p) => ({ ...p, [taskId]: { ...p[taskId], attempts: (p[taskId]?.attempts ?? 0) + 1 } }));
          setFeedback((f) => ({ ...f, [taskId]: { ok: false, text: r.message } }));
          setAnnounce(r.message);
        }
        return r.correct;
      } catch (e) {
        const text = e instanceof Error ? e.message : "Submission failed";
        setFeedback((f) => ({ ...f, [taskId]: { ok: false, text } }));
        setAnnounce(text);
        return false;
      }
    },
    [mission.id, markSolved],
  );

  const requestHint = useCallback(
    async (taskId: string) => {
      try {
        const view = await api<TaskProgress>(`/api/missions/${mission.id}/tasks/${taskId}/hint`);
        setProgress((p) => ({ ...p, [taskId]: view }));
        setAnnounce(view.solution ? "Walkthrough revealed." : `Hint ${view.hints.length} revealed.`);
      } catch (e) {
        const text = e instanceof Error ? e.message : "Could not reveal hint";
        setFeedback((f) => ({ ...f, [taskId]: { ok: false, text } }));
        setAnnounce(text);
      }
    },
    [mission.id],
  );

  const loadEvidence = useCallback(
    async (id: string) => {
      if (evidenceCache[id]) return evidenceCache[id];
      const ev = await api<EvidenceFile>(`/api/missions/${mission.id}/evidence/${id}`, undefined, "GET");
      setEvidenceCache((c) => ({ ...c, [id]: ev }));
      return ev;
    },
    [evidenceCache, mission.id],
  );

  async function complete() {
    setCompleting(true);
    setCompleteError(null);
    try {
      await api(`/api/missions/${mission.id}/complete`);
      setCompleted(true);
      router.push(`/missions/${mission.id}/debrief`);
    } catch (e) {
      setCompleteError(e instanceof Error ? e.message : "Could not complete the mission");
      setCompleting(false);
    }
  }

  const goToTool = (t: ToolTab, evidenceId?: string) => {
    setTab(t);
    if (evidenceId) setLogFocus(evidenceId);
    document.getElementById("tool-pane")?.focus();
  };

  return (
    <div className="max-w-[1600px]">
      <div aria-live="polite" className="sr-only">{announce}</div>
      <header className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <Link href={`/missions/${mission.id}`} className="t-small text-muted hover:text-ink">Back to briefing</Link>
          <div className="flex flex-wrap items-baseline gap-3 mt-1">
            <h1 className="t-h1">{mission.title}</h1>
            <span className="casefile">{mission.codename}</span>
          </div>
        </div>
        <div className="t-small text-muted" aria-label="Progress">
          {solvedCount} of {mission.tasks.length} objectives
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(22rem,27rem)_1fr] xl:h-[calc(100dvh-10rem)]">
        <section aria-label="Objectives" className="xl:overflow-y-auto scroll-thin xl:pr-2 space-y-3 min-w-0">
          {mission.tasks.map((t, i) => {
            const blockedBy = t.requires.filter((r) => !progress[r]?.solved).map((r) => mission.tasks.find((x) => x.id === r)?.title ?? r);
            return (
              <TaskCard
                key={t.id}
                index={i + 1}
                task={t}
                progress={progress[t.id]}
                feedback={feedback[t.id]}
                blockedBy={blockedBy}
                selection={t.evidenceId ? selections[t.evidenceId] ?? [] : []}
                onSubmit={(s) => submit(t.id, s)}
                onHint={() => requestHint(t.id)}
                onOpenTool={() =>
                  t.kind === "ordering"
                    ? goToTool("timeline")
                    : t.kind === "evidence_select"
                      ? goToTool("logs", t.evidenceId)
                      : t.kind === "terminal_observation"
                        ? goToTool("terminal")
                        : undefined
                }
              />
            );
          })}

          <div className={`rounded-[6px] p-4 border ${allSolved ? "border-teal bg-teal/10" : "border-dashed border-rule"}`}>
            {completed ? (
              <p className="t-small">
                Mission complete. <Link href={`/missions/${mission.id}/debrief`} className="link">Read the debrief</Link>
              </p>
            ) : allSolved ? (
              <>
                <p className="t-small mb-3">Every objective is solved. File your findings to receive the completion bonus and debrief.</p>
                <button className="btn btn-primary" onClick={complete} disabled={completing}>
                  {completing ? "Filing…" : `Complete mission (+${mission.completionXp} XP)`}
                </button>
                {completeError && <p role="alert" className="t-small text-alert mt-2">{completeError}</p>}
              </>
            ) : (
              <p className="t-small text-muted">Solve every objective to complete the mission. Progress saves automatically.</p>
            )}
          </div>
        </section>

        <section aria-label="Investigation tools" className="min-w-0 flex flex-col bg-panel border border-rule rounded-[8px] overflow-hidden min-h-[32rem]">
          <div role="tablist" aria-label="Tools" className="flex border-b border-rule overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t}
                role="tab"
                id={`tab-${t}`}
                aria-selected={tab === t}
                aria-controls="tool-pane"
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 t-small whitespace-nowrap border-b-2 -mb-px ${tab === t ? "border-teal text-ink" : "border-transparent text-muted hover:text-ink"}`}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>
          <div id="tool-pane" role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={-1} className="flex-1 min-h-0 flex flex-col focus:outline-none">
            {tab === "terminal" && mission.terminal && (
              <Terminal
                missionId={mission.id}
                env={mission.terminal}
                initialCwd={terminal?.cwd ?? mission.terminal.home}
                restored={(terminal?.history.length ?? 0) > 0}
                onSolved={(items) => items.forEach((s) => markSolved(s.taskId, s.xp, s.explanation, "Observed in terminal."))}
              />
            )}
            {tab === "logs" && (
              <LogViewer
                evidence={mission.evidence.filter((e) => e.format === "csv")}
                focusId={logFocus}
                load={loadEvidence}
                selections={selections}
                onToggle={(evId, rowId) =>
                  setSelections((s) => {
                    const cur = s[evId] ?? [];
                    return { ...s, [evId]: cur.includes(rowId) ? cur.filter((x) => x !== rowId) : [...cur, rowId] };
                  })
                }
                onClear={(evId) => setSelections((s) => ({ ...s, [evId]: [] }))}
              />
            )}
            {tab === "evidence" && <EvidenceViewer evidence={mission.evidence} load={loadEvidence} />}
            {tab === "timeline" && (
              <TimelineBuilder
                tasks={mission.tasks.filter((t) => t.kind === "ordering")}
                progress={progress}
                feedback={feedback}
                onSubmit={(taskId, order) => submit(taskId, { kind: "ordering", order })}
              />
            )}
          </div>
        </section>
      </div>
      <p className="t-micro text-muted mt-4 xl:hidden">Investigation tools work best on a larger screen; everything is usable here, just more compact.</p>
    </div>
  );
}
