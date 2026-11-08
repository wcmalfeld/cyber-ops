import Link from "next/link";
import { Meter, PageHeader, Planned } from "@/components/ui";
import { CAREERS, SKILL_INFO } from "@/content/catalog";
import { COMPANIES } from "@/content/companies";
import { db } from "@/db";
import { requireUser } from "@/server/auth";
import { missionCards, skillMasteries } from "@/server/profile";

export const metadata = { title: "Career Center" };

export default async function CareerPage() {
  const user = await requireUser();
  const [skills, cards] = await Promise.all([skillMasteries(db, user.id), missionCards(db, user.id)]);
  const lvl = (k: string) => skills.find((s) => s.skill === k)!;
  const done = cards.filter((c) => c.status === "completed");

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Career center"
        intro="How your demonstrated skills line up with common cybersecurity roles. This reflects practice in simulations — it is not a credential or certification, and no employer has endorsed it."
      />

      <section aria-labelledby="roles" className="mb-12">
        <h2 id="roles" className="t-h2">Role readiness</h2>
        <p className="t-small text-muted mt-1">Average mastery across each role&rsquo;s core skills.</p>
        <ul className="mt-4 divide-y divide-rule border-y border-rule">
          {CAREERS.map((c) => {
            const levels = c.skills.map((k) => lvl(k).levelIndex);
            const avg = levels.reduce((a, b) => a + b, 0) / levels.length / 6;
            const gaps = c.skills.filter((k) => lvl(k).levelIndex < 2);
            const relevant = done.filter((d) => d.mission.tasks.some((t) => t.skills.some((s) => c.skills.includes(s.skill))));
            return (
              <li key={c.id} className="py-4 grid gap-3 md:grid-cols-[16rem_1fr]">
                <div>
                  <h3 className="t-h3">{c.name}</h3>
                  <div className="mt-2 max-w-[12rem]"><Meter value={avg} label={`${c.name} readiness`} /></div>
                </div>
                <div className="t-small space-y-1">
                  <p><span className="text-muted">Core skills: </span>{c.skills.map((k) => `${SKILL_INFO[k].name} (${lvl(k).level})`).join(", ")}</p>
                  <p><span className="text-muted">Evidence: </span>{relevant.length ? relevant.map((r) => r.mission.title).join(", ") : "none yet"}</p>
                  {gaps.length > 0 && <p><span className="text-muted">Develop next: </span>{gaps.map((k) => SKILL_INFO[k].name).join(", ")}</p>}
                  <p><span className="text-muted">Colorado specialties: </span>
                    {c.companyIds.map((id, i) => {
                      const co = COMPANIES.find((x) => x.id === id)!;
                      return <span key={id}>{i > 0 && ", "}<Link href={`/industry#${id}`} className="link">{co.name}</Link></span>;
                    })}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="map" className="mb-12">
        <h2 id="map" className="t-h2">Colorado career map</h2>
        <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 t-small">
          {COMPANIES.map((c) => (
            <li key={c.id}>
              <a href={c.website} target="_blank" rel="noopener noreferrer" className="link">{c.name}</a>
              <span className="text-muted"> ({c.location}): {c.specialties.slice(0, 2).join(", ").toLowerCase()}</span>
            </li>
          ))}
        </ul>
        <p className="t-micro text-muted mt-4 prose-measure">Links go to company websites. CYBER OPS is not affiliated with these companies, and none of them recognize or use CYBER OPS results in hiring.</p>
      </section>

      <Planned phase="Phase 5">
        Formal mapping of missions to NIST NICE Framework work roles and competencies (current component version), interview practice mode, and shareable skills reports.
      </Planned>
    </div>
  );
}
