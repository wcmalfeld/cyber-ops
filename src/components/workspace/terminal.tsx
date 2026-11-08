"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";

interface Line {
  id: number;
  kind: "in" | "out" | "sys";
  text: string;
  prompt?: string;
}

const MAX_LINES = 1500;

/**
 * Front end for the server-side command interpreter. Every command is evaluated on the
 * server against the mission's synthetic filesystem; this component only renders.
 */
export function Terminal({
  missionId,
  env,
  initialCwd,
  restored,
  onSolved,
}: {
  missionId: string;
  env: { user: string; hostname: string; home: string; motd?: string };
  initialCwd: string;
  restored: boolean;
  onSolved: (items: { taskId: string; xp: number; explanation: string }[]) => void;
}) {
  const nextId = useRef(0);
  const mk = (kind: Line["kind"], text: string, prompt?: string): Line => ({ id: nextId.current++, kind, text, prompt });
  const [cwd, setCwd] = useState(initialCwd);
  const [lines, setLines] = useState<Line[]>(() => [
    ...(env.motd ? [mk("sys", env.motd)] : []),
    ...(restored ? [mk("sys", "Session restored. Your working directory and file changes were saved.")] : []),
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [past, setPast] = useState<string[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const prompt = `${env.user}@${env.hostname}:${cwd === env.home ? "~" : cwd.startsWith(env.home + "/") ? "~" + cwd.slice(env.home.length) : cwd}$`;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function run(cmd: string) {
    const shown = prompt;
    setLines((l) => [...l, mk("in", cmd, shown)].slice(-MAX_LINES));
    setInput("");
    setCursor(null);
    if (!cmd.trim()) return;
    setPast((p) => [...p, cmd].slice(-200));
    setBusy(true);
    try {
      const r = await api<{ output: string; clear: boolean; cwd: string; solved: { taskId: string; xp: number; explanation: string }[] }>(
        `/api/missions/${missionId}/terminal`,
        { input: cmd },
      );
      setCwd(r.cwd);
      if (r.clear) setLines([]);
      else if (r.output) setLines((l) => [...l, mk("out", r.output.replace(/\n$/, ""))].slice(-MAX_LINES));
      if (r.solved.length) {
        onSolved(r.solved);
        setLines((l) => [...l, mk("sys", `Objective complete${r.solved[0].xp ? ` (+${r.solved.reduce((a, s) => a + s.xp, 0)} XP)` : ""}.`)]);
      }
    } catch (e) {
      setLines((l) => [...l, mk("sys", e instanceof Error ? e.message : "Command failed")]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function reset() {
    try {
      const r = await api<{ cwd: string }>(`/api/missions/${missionId}/terminal/reset`);
      setCwd(r.cwd);
      setLines([mk("sys", "Environment reset to its original state. Completed objectives are kept.")]);
    } catch (e) {
      setLines((l) => [...l, mk("sys", e instanceof Error ? e.message : "Reset failed")]);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!past.length) return;
      const i = cursor === null ? past.length - 1 : Math.max(0, cursor - 1);
      setCursor(i);
      setInput(past[i]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (cursor === null) return;
      const i = cursor + 1;
      if (i >= past.length) {
        setCursor(null);
        setInput("");
      } else {
        setCursor(i);
        setInput(past[i]);
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-term border-t-2 border-transparent focus-within:border-teal/60">
      <div className="flex items-center justify-between px-4 py-2 border-b border-rule t-micro text-muted">
        <span>Simulated shell. Type <span className="data text-ink">help</span> for commands. Up/down recalls history.</span>
        <button className="hover:text-ink underline underline-offset-2" onClick={reset}>Reset environment</button>
      </div>
      <div
        className="flex-1 min-h-[20rem] overflow-y-auto scroll-thin px-4 py-3 font-mono text-[0.86rem] leading-relaxed"
        onClick={() => {
          if (!window.getSelection()?.toString()) inputRef.current?.focus();
        }}
        role="log"
        aria-label="Terminal output"
        aria-live="polite"
      >
        {lines.map((l) =>
          l.kind === "in" ? (
            <div key={l.id} className="whitespace-pre-wrap break-all">
              <span className="text-teal">{l.prompt}</span> {l.text}
            </div>
          ) : (
            <div key={l.id} className={`whitespace-pre-wrap break-all ${l.kind === "sys" ? "text-signal" : "text-ink/90"}`}>
              {l.text}
            </div>
          ),
        )}
        <form
          className="flex items-baseline gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) run(input);
          }}
        >
          <label htmlFor="term-input" className="text-teal shrink-0">{prompt}</label>
          <input
            id="term-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            className="flex-1 min-w-0 bg-transparent text-ink caret-teal focus-visible:outline-none"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={500}
            aria-label="Command"
            readOnly={busy}
            aria-busy={busy}
          />
        </form>
        <div ref={endRef} />
      </div>
    </div>
  );
}
