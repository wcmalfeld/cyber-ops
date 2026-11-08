import Link from "next/link";
import { notFound } from "next/navigation";
import { FactCheck, References } from "@/components/references";
import { Planned } from "@/components/ui";
import { COMPANIES } from "@/content/companies";
import { DOSSIERS, dossierById } from "@/content/dossiers";

export function generateStaticParams() {
  return DOSSIERS.map((d) => ({ dossierId: d.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ dossierId: string }> }) {
  return { title: dossierById((await params).dossierId)?.title ?? "Dossier" };
}

export default async function DossierPage({ params }: { params: Promise<{ dossierId: string }> }) {
  const d = dossierById((await params).dossierId);
  if (!d) notFound();
  const companies = COMPANIES.filter((c) => d.companyIds.includes(c.id));
  return (
    <article className="max-w-4xl">
      <Link href="/dossiers" className="t-small text-muted hover:text-ink">Breach dossiers</Link>
      <p className="casefile mt-4">Dossier {d.number}</p>
      <h1 className="t-display mt-3">{d.title}</h1>
      <p className="text-muted mt-2">{d.incident}, {d.incidentDate}</p>

      <section aria-labelledby="hb" className="mt-10 border-l-2 border-amber pl-5">
        <h2 id="hb" className="t-h2">Historical incident briefing</h2>
        <div className="mt-3 space-y-3 prose-measure">{d.historicalBriefing.map((p) => <p key={p}>{p}</p>)}</div>
        <div className="mt-3"><FactCheck {...d.factCheck} /></div>
        {d.timeline.length > 0 && (
          <ol className="mt-5 space-y-1.5 t-small">
            {d.timeline.map((e) => <li key={e.date + e.event}><span className="data text-faint mr-2">{e.date}</span>{e.event}</li>)}
          </ol>
        )}
      </section>

      <section aria-labelledby="core" className="mt-10">
        <h2 id="core" className="t-h2">Core subjects</h2>
        <ul className="mt-3 flex flex-wrap gap-2">{d.coreSubjects.map((c) => <li key={c} className="t-small px-2.5 py-1 rounded-[3px] bg-raised">{c}</li>)}</ul>
      </section>

      <section aria-labelledby="sim" className="mt-10 border-l-2 border-teal pl-5">
        <h2 id="sim" className="t-h2">The investigation</h2>
        <p className="mt-2 prose-measure">{d.plannedScenario}</p>
        {d.missionId ? (
          <Link href={`/missions/${d.missionId}`} className="btn btn-primary mt-4">Open the mission briefing</Link>
        ) : (
          <div className="mt-4"><Planned phase="Phase 2">This dossier&rsquo;s playable investigation is being built as a content module on the existing mission engine.</Planned></div>
        )}
      </section>

      <section aria-labelledby="ls" className="mt-10">
        <h2 id="ls" className="t-h2">Lessons</h2>
        <ul className="mt-3 list-disc pl-5 space-y-1.5 prose-measure">{d.lessons.map((l) => <li key={l}>{l}</li>)}</ul>
      </section>

      {companies.length > 0 && (
        <section aria-labelledby="ind" className="mt-10">
          <h2 id="ind" className="t-h2">Related industry specialties</h2>
          <ul className="mt-3 space-y-1 t-small">
            {companies.map((c) => <li key={c.id}><Link href={`/industry#${c.id}`} className="link">{c.name}</Link><span className="text-muted">: {c.specialties.slice(0, 2).join(", ").toLowerCase()}</span></li>)}
          </ul>
        </section>
      )}

      <div className="mt-10"><References refs={d.references} /></div>
    </article>
  );
}
