import type { Reference } from "@/engine/schema";

export function References({ refs, heading = "Sources and references" }: { refs: Reference[]; heading?: string }) {
  if (!refs.length) return null;
  return (
    <section aria-label={heading}>
      <h2 className="t-h3">{heading}</h2>
      <ul className="mt-2 space-y-2 t-small">
        {refs.map((r) => (
          <li key={r.url}>
            <a className="link" href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a>
            <span className="text-muted"> ({r.publisher})</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FactCheck({ status, checkedOn, notes }: { status: "verified" | "pending"; checkedOn: string | null; notes: string }) {
  return (
    <p className={`t-micro ${status === "verified" ? "text-teal" : "text-amber"}`} title={notes}>
      {status === "verified" ? `Source-checked ${checkedOn}` : "Source review pending — treat as a summary of the cited reporting"}
    </p>
  );
}
