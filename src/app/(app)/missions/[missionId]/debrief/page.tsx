import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FactCheck, References } from "@/components/references";
import { Rich } from "@/components/rich";
import { Meter } from "@/components/ui";
import { SKILL_INFO } from "@/content/catalog";
import { dossierById } from "@/content/dossiers";
import { db } from "@/db";
import { requireUser } from "@/server/auth";
import { getAttempt, getMissionProgress } from "@/server/game";
import { getMission } from "@/server/missions-repo";
import { skillMasteries } from "@/server/profile";

export const metadata = { title: "Debrief" };

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`d-${n}`} className="grid gap-2 md:grid-cols-[13rem_1fr] py-6 border-t border-rule">
      <h2 id={`d-${n}`} className="t-h3"><span className="text-faint font-normal mr-2">{n}</span>{title}</h2>
      <div className="min-w-0 prose-measure">{children}</div>
    </section>
  );
}

export default async function DebriefPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params;
  const user = await requireUser();
  const attempt = await getAttempt(db, user.id, missionId);
  if (!attempt || attempt.status !== "completed") redirect(`/missions/${missionId}`);
  const mission = await getMission(db, missionId, attempt.version);
  if (!mission) notFound();
  const [{ tasks }, skills] = await Promise.all([getMissionProgress(db, user.id, mission), skillMasteries(db, user.id)]);
  const d = mission.debrief;
  const dossier = mission.dossierId ? dossierById(mission.dossierId) : undefined;
  const touched = [...new Set(mission.tasks.flatMap((t) => t.skills.map((s) => s.skill)))];
  const assisted = mission.tasks.filter((t) => tasks[t.id].hintsUsed > 0 || tasks[t.id].solutionRevealed).length;

  return (
    <article className="max-w-5xl">
      <p className="casefile">{mission.codename} debrief</p>
      <h1 className="t-display mt-3">{mission.title}</h1>
      <p className="text-muted mt-2">
        {assisted === 0 ? "Completed independently — no hints used." : `Completed with assistance on ${assisted} of ${mission.tasks.length} objectives.`}
      </p>

      <div className="mt-8">
        <Section n={1} title="Mission summary"><p><Rich text={d.summary} /></p></Section>
        <Section n={2} title="What happened">
          <p><Rich text={d.whatHappened} /></p>
          <p className="mt-3"><span className="font-medium">Why it was possible. </span><Rich text={d.whyPossible} /></p>
        </Section>
        <Section n={3} title="What you discovered">
          <ul className="space-y-3">
            {mission.tasks.map((t) => {
              const p = tasks[t.id];
              const how = p.solutionRevealed ? "walkthrough used" : p.hintsUsed ? `${p.hintsUsed} hint${p.hintsUsed > 1 ? "s" : ""}` : "independent";
              return (
                <li key={t.id}>
                  <p className="font-medium t-small">{t.title} <span className="text-muted font-normal">({how}{p.attempts ? `, ${p.attempts} incorrect attempt${p.attempts > 1 ? "s" : ""}` : ""})</span></p>
                  <p className="t-small text-muted"><Rich text={t.explanation} /></p>
                </li>
              );
            })}
          </ul>
        </Section>
        <Section n={4} title="Technical explanation"><p><Rich text={d.technicalExplanation} /></p></Section>
        <Section n={5} title="Tools and commands">
          <dl className="space-y-2 t-small">
            {d.toolsUsed.map((t) => (
              <div key={t.name}><dt className="data inline text-ink">{t.name}</dt><dd className="inline text-muted">: {t.purpose}</dd></div>
            ))}
          </dl>
        </Section>
        <Section n={6} title="Techniques involved">
          <ul className="space-y-1.5 t-small">
            {d.techniques.map((t) => (
              <li key={t.id}>
                <span className="data text-faint mr-2">{t.id}</span>
                {t.url ? <a className="link" href={t.url} target="_blank" rel="noopener noreferrer">{t.name}</a> : t.name}
              </li>
            ))}
          </ul>
          <p className="t-micro text-muted mt-2">Technique IDs from MITRE ATT&amp;CK.</p>
        </Section>
        <Section n={7} title="Key concepts">
          <dl className="space-y-3 t-small">
            {d.concepts.map((c) => (
              <div key={c.term}><dt className="font-medium">{c.term}</dt><dd className="text-muted"><Rich text={c.definition} /></dd></div>
            ))}
          </dl>
        </Section>
        <Section n={8} title="Recommended defenses">
          <ul className="list-disc pl-5 space-y-1.5 t-small">{d.defenses.map((x) => <li key={x}><Rich text={x} /></li>)}</ul>
        </Section>
        <Section n={9} title="Common mistakes">
          <ul className="list-disc pl-5 space-y-1.5 t-small">{d.commonMistakes.map((x) => <li key={x}><Rich text={x} /></li>)}</ul>
        </Section>
        <Section n={10} title="Further reading"><References refs={d.resources} heading="Resources" /></Section>

        {dossier && (
          <section aria-labelledby="hist" className="mt-4 border border-amber/40 rounded-[8px] p-6">
            <h2 id="hist" className="t-h2">Historical incident debrief</h2>
            <p className="t-small text-muted mt-1">Dossier {dossier.number}: {dossier.incident}. What actually happened, and what this simulation invented.</p>
            <FactCheck {...dossier.factCheck} />
            <div className="grid gap-8 md:grid-cols-2 mt-5">
              <div>
                <h3 className="t-h3">Confirmed by public reporting</h3>
                <div className="mt-2 space-y-2 t-small">{dossier.historicalBriefing.map((p) => <p key={p}>{p}</p>)}</div>
                {dossier.timeline.length > 0 && (
                  <>
                    <h3 className="t-h3 mt-5">Public timeline</h3>
                    <ol className="mt-2 space-y-1.5 t-small">
                      {dossier.timeline.map((e) => (
                        <li key={e.date + e.event}><span className="data text-faint mr-2">{e.date}</span>{e.event} <span className="text-muted">[{e.sourceIndex + 1}]</span></li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
              <div>
                <h3 className="t-h3">Fictionalized for this exercise</h3>
                <ul className="mt-2 list-disc pl-5 space-y-1.5 t-small text-muted">{dossier.fictionalizedElements.map((x) => <li key={x}>{x}</li>)}</ul>
                <h3 className="t-h3 mt-5">Lessons learned</h3>
                <ul className="mt-2 list-disc pl-5 space-y-1.5 t-small">{dossier.lessons.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            </div>
            <div className="mt-6">
              <h3 className="t-h3">Sources</h3>
              <ol className="mt-2 space-y-1.5 t-small list-decimal pl-5">
                {dossier.references.map((r) => (
                  <li key={r.url}><a className="link" href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a> <span className="text-muted">({r.publisher})</span></li>
                ))}
              </ol>
            </div>
          </section>
        )}

        <section aria-labelledby="skills-up" className="mt-8 border-t border-rule pt-6">
          <h2 id="skills-up" className="t-h2">Skill profile update</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {touched.map((sk) => {
              const m = skills.find((x) => x.skill === sk)!;
              return (
                <li key={sk}>
                  <div className="flex justify-between t-small"><span>{SKILL_INFO[sk].name}</span><span className="text-teal">{m.level}</span></div>
                  <Meter value={m.levelIndex / 6} label={`${SKILL_INFO[sk].name} mastery`} tone="signal" />
                  {m.nextRequirement && <p className="t-micro text-muted mt-1">{m.nextRequirement}</p>}
                </li>
              );
            })}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="btn btn-primary">Back to Mission Control</Link>
            <Link href="/skills" className="btn btn-quiet">Open skill profile</Link>
          </div>
        </section>
      </div>
    </article>
  );
}
