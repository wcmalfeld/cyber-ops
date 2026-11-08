import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { PATH_INFO, SKILL_INFO } from "@/content/catalog";
import { INDUSTRY_DISCLAIMER, type CompanyProfile } from "@/content/companies";
import { db } from "@/db";
import * as s from "@/db/schema";
import { requireUser } from "@/server/auth";
import { listMissions } from "@/server/missions-repo";

export const metadata = { title: "Industry Labs" };

export default async function IndustryPage() {
  await requireUser();
  // Profiles are editable records in the database (seeded from src/content/companies.ts).
  const rows = await db.select().from(s.companyProfiles).orderBy(s.companyProfiles.name);
  const companies = rows.map((r) => r.data as CompanyProfile);
  const missions = await listMissions(db);

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Industry labs"
        intro="Cybersecurity companies working in Boulder and along the Front Range, what they specialize in, and which training builds the skills those specialties use. Listed alphabetically."
      />
      <p className="t-small text-muted border-l-2 border-rule pl-4 mb-10 prose-measure">{INDUSTRY_DISCLAIMER}</p>

      <ul className="space-y-12">
        {companies.map((c) => {
          const related = missions.filter((m) => m.companyIds.includes(c.id));
          return (
            <li key={c.id} id={c.id} className="scroll-mt-8 grid gap-6 md:grid-cols-[14rem_1fr]">
              <div>
                <h2 className="t-h2">{c.name}</h2>
                <p className="t-small text-muted">{c.location}</p>
                <a className="link t-small break-all" href={c.website} target="_blank" rel="noopener noreferrer">{c.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>
                {c.review.status === "pending" && <p className="t-micro text-amber mt-2" title={c.review.notes}>Profile review pending</p>}
              </div>
              <div className="space-y-4 min-w-0">
                <p className="prose-measure">{c.description}</p>
                <p className="t-small text-muted prose-measure"><span className="text-ink font-medium">Problems this specialty addresses. </span>{c.problemsAddressed}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="t-small font-medium">Specialties</h3>
                    <ul className="mt-1 t-small text-muted space-y-0.5">{c.specialties.map((x) => <li key={x}>{x}</li>)}</ul>
                  </div>
                  <div>
                    <h3 className="t-small font-medium">Concepts to know</h3>
                    <ul className="mt-1 t-small text-muted space-y-0.5">{c.concepts.map((x) => <li key={x}>{x}</li>)}</ul>
                  </div>
                </div>
                <div className="t-small">
                  <span className="font-medium">Relevant training: </span>
                  <span className="text-muted">{c.relatedPaths.map((p) => PATH_INFO[p].name).join("; ")}. Skills: {c.relatedSkills.map((k) => SKILL_INFO[k].name).join(", ")}.</span>
                </div>
                <div className="t-small">
                  <span className="font-medium">Related challenges: </span>
                  {related.length ? (
                    related.map((m, i) => (
                      <span key={m.id}>{i > 0 && ", "}<Link className="link" href={`/missions/${m.id}`}>{m.title}</Link></span>
                    ))
                  ) : (
                    <span className="text-muted">In development — {c.platformInspiration.toLowerCase()}</span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
