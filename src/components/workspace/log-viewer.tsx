"use client";
import { useEffect, useMemo, useState } from "react";
import { parseCsv, type ParsedCsv } from "@/lib/csv";
import type { ClientMission, EvidenceFile } from "./types";

type Meta = ClientMission["evidence"][number];
interface Filter {
  column: string;
  op: "is" | "is not" | "contains";
  value: string;
}

const LOCAL_TZ = "America/Denver";

function localTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", { timeZone: LOCAL_TZ, dateStyle: "medium", timeStyle: "medium" }) + " (Denver)";
}

function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-amber/30 text-ink rounded-[2px]">{text.slice(i, i + term.length)}</mark>
      {text.slice(i + term.length)}
    </>
  );
}

function toCsv(columns: string[], rows: Record<string, string>[]) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c] ?? "")).join(","))].join("\n") + "\n";
}

export function LogViewer({
  evidence,
  focusId,
  load,
  selections,
  onToggle,
  onClear,
}: {
  evidence: Meta[];
  focusId?: string;
  load: (id: string) => Promise<EvidenceFile>;
  selections: Record<string, string[]>;
  onToggle: (evidenceId: string, rowId: string) => void;
  onClear: (evidenceId: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | undefined>(focusId ?? evidence[0]?.id);
  const [data, setData] = useState<Record<string, ParsedCsv>>({});
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [draft, setDraft] = useState<Filter>({ column: "", op: "is", value: "" });
  const [markedOnly, setMarkedOnly] = useState(false);

  const [seenFocus, setSeenFocus] = useState(focusId);

  // Switching files resets the view (filters, sort, hidden fields).
  const switchTo = (id: string | undefined) => {
    setActiveId(id);
    setFilters([]);
    setSearch("");
    setSort(null);
    setHidden([]);
    setMarkedOnly(false);
  };
  // Follow focus requests from objectives ("Open log viewer") — adjusted during render, per React guidance.
  if (focusId !== seenFocus) {
    setSeenFocus(focusId);
    if (focusId && focusId !== activeId) switchTo(focusId);
  }

  const meta = evidence.find((e) => e.id === activeId);
  const parsed = activeId ? data[activeId] : undefined;

  useEffect(() => {
    if (!activeId || data[activeId]) return;
    load(activeId)
      .then((ev) => setData((d) => ({ ...d, [activeId]: parseCsv(ev.content) })))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load evidence"));
  }, [activeId, data, load]);

  const idCol = meta?.rowIdColumn ?? "";
  const marked = useMemo(() => (activeId ? selections[activeId] ?? [] : []), [activeId, selections]);

  const rows = useMemo(() => {
    if (!parsed) return [];
    let out = parsed.rows;
    if (markedOnly) out = out.filter((r) => marked.includes(r[idCol]));
    for (const f of filters) {
      const v = f.value.toLowerCase();
      out = out.filter((r) => {
        const cell = (r[f.column] ?? "").toLowerCase();
        return f.op === "is" ? cell === v : f.op === "is not" ? cell !== v : cell.includes(v);
      });
    }
    if (search) {
      const q = search.toLowerCase();
      out = out.filter((r) => Object.values(r).some((v) => v.toLowerCase().includes(q)));
    }
    if (sort) {
      out = [...out].sort((a, b) => {
        const x = a[sort.col] ?? "", y = b[sort.col] ?? "";
        const nx = Number(x), ny = Number(y);
        const cmp = x !== "" && y !== "" && !Number.isNaN(nx) && !Number.isNaN(ny) ? nx - ny : x.localeCompare(y);
        return cmp * sort.dir;
      });
    }
    return out;
  }, [parsed, filters, search, sort, markedOnly, marked, idCol]);

  const columns = parsed?.columns.filter((c) => !hidden.includes(c)) ?? [];

  const addFilter = (f: Filter) => {
    if (!f.column || f.value === "") return;
    setFilters((fs) => (fs.some((x) => x.column === f.column && x.op === f.op && x.value === f.value) ? fs : [...fs, f]));
  };

  function exportMarked() {
    if (!parsed) return;
    const sel = parsed.rows.filter((r) => marked.includes(r[idCol]));
    const blob = new Blob([toCsv(parsed.columns, sel)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `findings_${meta?.name ?? "evidence.csv"}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!evidence.length) return <p className="p-4 t-small text-muted">No log evidence in this mission.</p>;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* File picker + search */}
      <div className="p-3 border-b border-rule space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <label className="sr-only" htmlFor="log-file">Log file</label>
          <select id="log-file" className="field w-auto data" value={activeId} onChange={(e) => switchTo(e.target.value)}>
            {evidence.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="log-search">Search all fields</label>
          <input id="log-search" className="field flex-1 min-w-[10rem]" placeholder="Search all fields" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {meta && <p className="t-micro text-muted">{meta.description} Source: {meta.source}.</p>}

        <form
          className="flex flex-wrap gap-2 items-center"
          onSubmit={(e) => {
            e.preventDefault();
            addFilter(draft);
            setDraft((d) => ({ ...d, value: "" }));
          }}
        >
          <label className="sr-only" htmlFor="flt-col">Filter column</label>
          <select id="flt-col" className="field w-auto t-small" value={draft.column} onChange={(e) => setDraft({ ...draft, column: e.target.value })}>
            <option value="">Field…</option>
            {parsed?.columns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="sr-only" htmlFor="flt-op">Operator</label>
          <select id="flt-op" className="field w-auto t-small" value={draft.op} onChange={(e) => setDraft({ ...draft, op: e.target.value as Filter["op"] })}>
            <option value="is">is</option>
            <option value="is not">is not</option>
            <option value="contains">contains</option>
          </select>
          <label className="sr-only" htmlFor="flt-val">Value</label>
          <input id="flt-val" className="field w-40 data" placeholder="value" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
          <button className="btn btn-quiet" disabled={!draft.column || !draft.value}>Add filter</button>
          <details className="relative">
            <summary className="btn btn-quiet list-none cursor-pointer">Fields</summary>
            <div className="absolute z-10 mt-1 p-3 bg-raised border border-rule rounded-[6px] space-y-1 min-w-[12rem]">
              {parsed?.columns.map((c) => (
                <label key={c} className="flex gap-2 t-small items-center">
                  <input type="checkbox" checked={!hidden.includes(c)} onChange={() => setHidden((h) => (h.includes(c) ? h.filter((x) => x !== c) : [...h, c]))} />
                  <span className="data">{c}</span>
                </label>
              ))}
            </div>
          </details>
        </form>

        {(filters.length > 0 || markedOnly) && (
          <ul className="flex flex-wrap gap-2" aria-label="Active filters">
            {filters.map((f, i) => (
              <li key={i}>
                <button
                  className="t-micro px-2 py-1 rounded-[3px] bg-signal/15 text-signal hover:bg-signal/25"
                  onClick={() => setFilters((fs) => fs.filter((_, j) => j !== i))}
                  aria-label={`Remove filter ${f.column} ${f.op} ${f.value}`}
                >
                  <span className="data">{f.column} {f.op} {f.value}</span> <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
            {markedOnly && (
              <li>
                <button className="t-micro px-2 py-1 rounded-[3px] bg-teal/15 text-teal" onClick={() => setMarkedOnly(false)}>
                  Marked rows only <span aria-hidden="true">×</span>
                </button>
              </li>
            )}
            <li><button className="t-micro text-muted underline" onClick={() => { setFilters([]); setMarkedOnly(false); }}>Clear all</button></li>
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 t-micro text-muted">
          <span aria-live="polite">
            Showing <strong className="text-ink font-medium">{rows.length}</strong> of {parsed?.rows.length ?? 0} rows
          </span>
          {idCol && (
            <span className="flex flex-wrap items-center gap-3">
              <span>{marked.length} marked as evidence</span>
              <button className="underline disabled:opacity-50" disabled={!marked.length} onClick={() => setMarkedOnly(true)}>Show marked</button>
              <button className="underline disabled:opacity-50" disabled={!marked.length} onClick={exportMarked}>Export findings</button>
              <button className="underline disabled:opacity-50" disabled={!marked.length} onClick={() => activeId && onClear(activeId)}>Unmark all</button>
            </span>
          )}
        </div>
        <p className="t-micro text-faint">Click any value to filter by it. Hover a timestamp to see Denver local time.</p>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-[18rem] overflow-auto scroll-thin bg-term">
        {error ? (
          <p role="alert" className="p-4 t-small text-alert">{error}</p>
        ) : !parsed ? (
          <p className="p-4 t-small text-muted">Loading evidence…</p>
        ) : (
          <table className="w-full border-collapse data text-[0.8rem]">
            <caption className="sr-only">{meta?.name}</caption>
            <thead className="sticky top-0 bg-panel z-[1]">
              <tr>
                {idCol && <th scope="col" className="px-2 py-2 text-left font-normal text-muted w-8"><span className="sr-only">Mark as evidence</span></th>}
                {columns.map((c) => (
                  <th key={c} scope="col" aria-sort={sort?.col === c ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className="px-2 py-2 text-left font-normal text-muted whitespace-nowrap">
                    <button
                      className="hover:text-ink"
                      onClick={() => setSort((s) => (s?.col === c ? (s.dir === 1 ? { col: c, dir: -1 } : null) : { col: c, dir: 1 }))}
                    >
                      {c} <span aria-hidden="true">{sort?.col === c ? (sort.dir === 1 ? "▲" : "▼") : ""}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const id = r[idCol];
                const isMarked = marked.includes(id);
                return (
                  <tr key={id ?? JSON.stringify(r)} className={`border-t border-rule/60 ${isMarked ? "bg-teal/10" : "hover:bg-raised/50"}`}>
                    {idCol && (
                      <td className="px-2 py-1">
                        <input type="checkbox" checked={isMarked} onChange={() => activeId && onToggle(activeId, id)} aria-label={`Mark ${id} as evidence`} />
                      </td>
                    )}
                    {columns.map((c) => {
                      const v = r[c] ?? "";
                      const isTs = c === meta?.timestampColumn;
                      return (
                        <td key={c} className="px-2 py-1 whitespace-nowrap">
                          <button
                            className="text-left hover:text-signal focus-visible:text-signal"
                            title={isTs ? localTime(v) ?? undefined : `Filter ${c} is ${v}`}
                            onClick={() => addFilter({ column: c, op: "is", value: v })}
                          >
                            <Highlight text={v} term={search} />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
