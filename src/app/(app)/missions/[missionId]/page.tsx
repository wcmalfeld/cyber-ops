import Link from "next/link";
import { notFound } from "next/navigation";
import { FactCheck, References } from "@/components/references";
import { Rich } from "@/components/rich";
import { StartButton } from "@/components/start-button";
import { DifficultyMeter, Planned, StatusPill } from "@/components/ui";
import { COMPANIES } from "@/content/companies";
import { dossierById } from "@/content/dossiers";
import { PATH_INFO } from "@/content/catalog";
import { db } from "@/db";
import { LEVEL_NAMES } from "@/engine/progression";
import { requireUser } from "@/server/auth";
import { getMission } from "@/server/missions-repo";
import { missionCards } from "@/server/profile";

const TOOL_NAMES = { terminal: "Simulated terminal", evidence_viewer: "Evidence viewer", log_viewer: "Log viewer", timeline_builder: "Timeline builder" };

export async function generateMetadata({ params }: { params: Promise<{ missionId: string }> }) {
  const m = await getMission(db, (await params).missionId);
  return { title: m?.title ?? "Mission" };
}

export default async function MissionBriefing({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params;
  const user = await requireUser();
  const mission = await getMission(db, missionId);
  if (!mission) notFound();
  const card = (await missionCards(db, user.id)).find((c) => c.mission.id === missionId)!;
  const dossier = mission.dossierId ? dossierById(mission.dossierId) : undefined;
  const companies = COMPANIES.filter((c) => mission.companyIds.includes(c.id));

  return (
    <article className="max-w-5xl">
      <nav aria-label="Breadcrumb" className="t-small text-muted mb-6">
        <Link href="/paths" className="hover:text-ink">Training paths</Link> / {LEVEL_NAMES[mission.level]}
      </nav>
      <p className="casefile">{mission.codename}</p>
      <h1 className="t-display mt-3">{mission.title}</h1>
      <p className="text-muted mt-3 prose-measure">{mission.summary}</p>
      <div className="mt-4 flex flex-wrap items-center gap-4 t-small text-muted">
        <DifficultyMeter difficulty={mission.difficulty} />
        <span>{mission.estimatedMinutes} min</span>
        <span>{PATH_INFO[mission.path].name}</span>
        <span>{mission.tasks.length} objectives, up to {mission.completionXp + mission.tasks.reduce((s, t) => s + t.xp, 0)} XP</span>
        <StatusPill status={card.status} recommended={card.recommended} />
      </div>

      <div className="mt-7 flex flex-wrap gap-3 items-start">
        {card.status === "locked" ? (
          <p className="t-small text-amber">Locked: {card.lockedReasons.join("; ")}</p>
        ) : (
          <StartButton missionId={mission.id} label={card.status === "in_progress" ? "Resume mission" : card.status === "completed" ? "Review workspace" : "Start mission"} />
        )}
        {card.status === "completed" && <Link href={`/missions/${mission.id}/debrief`} className="btn btn-quiet">Read debrief</Link>}
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-10 min-w-0">
          {dossier && (
            <section aria-labelledby="hist-heading" className="border-l-2 border-amber pl-5">
              <h2 id="hist-heading" className="t-h2">Historical incident briefing</h2>
              <p className="t-small text-muted">
                Dossier {dossier.number}: {dossier.incident}, {dossier.incidentDate}. This section is the public record — the investigation below is a fictional simulation.
              </p>
              <div className="mt-3 space-y-3 prose-measure">
                {dossier.historicalBriefing.map((p) => <p key={p}>{p}</p>)}
              </div>
              <div className="mt-3"><FactCheck {...dossier.factCheck} /></div>
              <div className="mt-4"><References refs={dossier.references} heading="Historical sources" /></div>
            </section>
          )}

          <section aria-labelledby="obj-heading">
            <h2 id="obj-heading" className="t-h2">Learning objectives</h2>
            <ul className="mt-3 space-y-1.5 list-disc pl-5 prose-measure">
              {mission.learningObjectives.map((o) => <li key={o}>{o}</li>)}
            </ul>
          </section>

          <section aria-labelledby="scn-heading" className="border-l-2 border-teal pl-5">
            <h2 id="scn-heading" className="t-h2">Scenario</h2>
            <p className="t-small text-muted">Simulation. Organizations, people and evidence are fictional.</p>
            <dl className="mt-3 t-small grid grid-cols-[6rem_1fr] gap-y-1">
              <dt className="text-muted">Organization</dt><dd>{mission.briefing.organization}</dd>
              <dt className="text-muted">Your role</dt><dd>{mission.briefing.role}</dd>
            </dl>
            <div className="mt-4 space-y-3 prose-measure">
              {mission.briefing.situation.map((p) => <p key={p}>{p}</p>)}
            </div>
          </section>

          <section aria-labelledby="ev-heading">
            <h2 id="ev-heading" className="t-h2">Available evidence and tools</h2>
            <ul className="mt-3 space-y-2">
              {mission.terminal && (
                <li className="t-small"><span className="data block">{mission.terminal.user}@{mission.terminal.hostname}</span><span className="text-muted">Interactive shell on a synthetic filesystem.</span></li>
              )}
              {mission.evidence.map((e) => (
                <li key={e.id} className="t-small"><span className="data block">{e.name}</span><span className="text-muted">{e.description}</span></li>
              ))}
            </ul>
            <p className="t-small text-muted mt-3">Tools: {mission.tools.map((t) => TOOL_NAMES[t]).join(", ")}</p>
          </section>

          <section aria-labelledby="tasks-heading">
            <h2 id="tasks-heading" className="t-h2">Mission objectives</h2>
            <ol className="mt-3 space-y-1.5 list-decimal pl-5">
              {mission.tasks.map((t) => (
                <li key={t.id} className="t-small">{t.title} <span className="text-muted">({t.xp} XP)</span></li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-8">
          {mission.briefing.glossary.length > 0 && (
            <section aria-labelledby="gl-heading">
              <h2 id="gl-heading" className="t-h3">Field manual</h2>
              <p className="t-micro text-muted">Terms you&rsquo;ll meet in this mission.</p>
              <dl className="mt-3 space-y-3 t-small">
                {mission.briefing.glossary.map((g) => (
                  <div key={g.term}>
                    <dt className="font-medium">{g.term}</dt>
                    <dd className="text-muted"><Rich text={g.definition} /></dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {companies.length > 0 && (
            <section aria-labelledby="co-heading">
              <h2 id="co-heading" className="t-h3">Industry connection</h2>
              <ul className="mt-2 space-y-1 t-small">
                {companies.map((c) => (
                  <li key={c.id}><Link href={`/industry#${c.id}`} className="link">{c.name}</Link><span className="block text-muted">{c.specialties[0]}</span></li>
                ))}
              </ul>
            </section>
          )}
          <Planned phase="Phase 4">An AI mentor that can explain terms and evidence in context. Progressive hints inside the workspace are available now.</Planned>
        </aside>
      </div>
    </article>
  );
}
