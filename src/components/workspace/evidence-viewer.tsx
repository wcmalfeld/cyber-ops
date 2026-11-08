"use client";
import { useEffect, useState } from "react";
import type { ClientMission, EvidenceFile } from "./types";

type Meta = ClientMission["evidence"][number];

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function pretty(ev: EvidenceFile) {
  if (ev.format !== "json") return ev.content;
  try {
    return JSON.stringify(JSON.parse(ev.content), null, 2);
  } catch {
    return ev.content;
  }
}

export function EvidenceViewer({ evidence, load }: { evidence: Meta[]; load: (id: string) => Promise<EvidenceFile> }) {
  const [activeId, setActiveId] = useState(evidence.find((e) => e.format !== "csv")?.id ?? evidence[0]?.id);
  const [loaded, setLoaded] = useState<{ id: string; file: EvidenceFile; hash: string } | null>(null);
  const [find, setFind] = useState("");
  const [error, setError] = useState<string | null>(null);
  const meta = evidence.find((e) => e.id === activeId);
  const file = loaded?.id === activeId ? loaded.file : null;
  const hash = loaded?.id === activeId ? loaded.hash : "";

  useEffect(() => {
    if (!activeId) return;
    let live = true;
    load(activeId)
      .then(async (ev) => {
        const hash = await sha256(ev.content);
        if (live) setLoaded({ id: activeId, file: ev, hash });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load evidence"));
    return () => {
      live = false;
    };
  }, [activeId, load]);

  const text = file ? pretty(file) : "";
  const lines = text.split("\n");
  const q = find.toLowerCase();
  const hits = q ? lines.filter((l) => l.toLowerCase().includes(q)).length : 0;

  return (
    <div className="flex-1 min-h-0 grid md:grid-cols-[14rem_1fr]">
      <ul className="border-b md:border-b-0 md:border-r border-rule p-2 space-y-0.5 overflow-y-auto scroll-thin" aria-label="Evidence files">
        {evidence.map((e) => (
          <li key={e.id}>
            <button
              onClick={() => setActiveId(e.id)}
              aria-current={e.id === activeId}
              className={`w-full text-left px-2.5 py-2 rounded-[4px] ${e.id === activeId ? "bg-raised" : "hover:bg-raised/60"}`}
            >
              <span className="block data text-[0.8rem] break-all">{e.name}</span>
              <span className="block t-micro text-muted">{e.source}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="min-w-0 flex flex-col min-h-[20rem]">
        {meta && (
          <dl className="px-4 py-3 border-b border-rule grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-0.5 t-micro">
            <dt className="text-muted">File</dt><dd className="data break-all">{meta.name}</dd>
            <dt className="text-muted">Source</dt><dd>{meta.source}</dd>
            <dt className="text-muted">Format</dt><dd>{meta.format.toUpperCase()}{file ? `, ${new TextEncoder().encode(file.content).length.toLocaleString()} bytes, ${lines.length} lines` : ""}</dd>
            <dt className="text-muted">SHA-256</dt><dd className="data break-all text-faint">{hash || "…"}</dd>
          </dl>
        )}
        <div className="px-4 py-2 border-b border-rule flex items-center gap-3">
          <label className="sr-only" htmlFor="ev-find">Find in file</label>
          <input id="ev-find" className="field max-w-xs" placeholder="Find in file" value={find} onChange={(e) => setFind(e.target.value)} />
          {q && <span className="t-micro text-muted" aria-live="polite">{hits} matching line{hits === 1 ? "" : "s"}</span>}
          {meta?.format === "csv" && <span className="t-micro text-muted">Tabular file. The log viewer can filter and sort it.</span>}
        </div>
        <div className="flex-1 overflow-auto scroll-thin bg-term">
          {error ? (
            <p role="alert" className="p-4 t-small text-alert">{error}</p>
          ) : !file ? (
            <p className="p-4 t-small text-muted">Loading…</p>
          ) : (
            <pre className="data text-[0.82rem] leading-relaxed p-4">
              {lines.map((l, i) => {
                const hit = q && l.toLowerCase().includes(q);
                return (
                  <div key={i} className={`flex ${hit ? "bg-amber/15" : ""}`}>
                    <span aria-hidden="true" className="select-none text-faint w-10 shrink-0 text-right pr-3">{i + 1}</span>
                    <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{l || " "}</span>
                  </div>
                );
              })}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
