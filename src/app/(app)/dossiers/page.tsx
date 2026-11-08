import Link from "next/link";
import { FactCheck } from "@/components/references";
import { PageHeader } from "@/components/ui";
import { DOSSIERS } from "@/content/dossiers";

export const metadata = { title: "Breach Dossiers" };

export default function DossiersPage() {
  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Breach dossiers"
        intro="Documented incidents, sourced from public reporting and official advisories — each paired with a fictional investigation that teaches the same attack pattern. The historical record and the simulation are always kept separate."
      />
      <ol className="divide-y divide-rule border-y border-rule">
        {DOSSIERS.map((d) => (
          <li key={d.id} className="py-5 grid gap-2 md:grid-cols-[5rem_1fr_auto] md:items-start">
            <span className="data text-faint">{d.number}</span>
            <div>
              <Link href={`/dossiers/${d.id}`} className="t-h3 hover:text-signal">{d.title}</Link>
              <p className="t-small text-muted">{d.incident}, {d.incidentDate}</p>
              <p className="t-small mt-1.5 prose-measure">{d.historicalBriefing[0]}</p>
              <div className="mt-1.5"><FactCheck {...d.factCheck} /></div>
            </div>
            <span className={`t-micro px-2 py-1 rounded-[3px] border justify-self-start ${d.missionId ? "border-teal/40 text-teal" : "border-rule text-muted"}`}>
              {d.missionId ? "Playable" : "Briefing only"}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
