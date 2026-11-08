import Link from "next/link";
import { DifficultyMeter, Meter, MissionRow } from "@/components/ui";
import { SKILL_INFO } from "@/content/catalog";
import { DOSSIERS } from "@/content/dossiers";
import { db } from "@/db";
import { LEVEL_NAMES } from "@/engine/progression";
import { requireUser } from "@/server/auth";
import { dailyIndex, userSummary } from "@/server/profile";

export const metadata = { title: "Mission Control" };

export default async function MissionControl() {
  const user = await requireUser();
  const sum = await userSummary(db, user.id);
  const next = sum.cards.find((c) => c.recommended);
  const completed = sum.cards.filter((c) => c.status === "completed").length;
  const open = sum.cards.filter((c) => c.status !== "completed");
  const drill = open.length ? open[dailyIndex(open.length)] : null;
  const briefing = DOSSIERS[dailyIndex(DOSSIERS.length)];
  const topSkills = [...sum.skills].filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  const earned = sum.achievements.filter((a) => a.earnedAt);
  const level = next?.mission.level ?? Math.max(0, ...sum.cards.filter((c) => c.status === "completed").map((c) => c.mission.level));

  return (
    <div className="max-w-6xl">
      <h1 className="sr-only">Mission Control</h1>
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        {/* Next case file */}
        <section aria-labelledby="next-heading" className="bg-panel border border-rule rounded-[8px] p-6 sm:p-8">
          {next ? (
            <>
              <p className="casefile">{next.mission.codename}</p>
              <h2 id="next-heading" className="t-display mt-4">{next.mission.title}</h2>
              <p className="mt-3 text-muted prose-measure">{next.mission.briefing.situation[0]}</p>
              <div className="mt-4 flex flex-wrap items-center gap-4 t-small text-muted">
                <DifficultyMeter difficulty={next.mission.difficulty} />
                <span>{next.mission.estimatedMinutes} min</span>
                <span>{next.mission.briefing.role}</span>
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={next.status === "in_progress" ? `/missions/${next.mission.id}/play` : `/missions/${next.mission.id}`} className="btn btn-primary">
                  Continue training
                </Link>
                <Link href="/paths" className="btn btn-quiet">Browse training paths</Link>
              </div>
              {next.status === "in_progress" && (
                <p className="t-micro text-muted mt-4">
                  {next.solvedTasks} of {next.mission.tasks.length} objectives done — your terminal and answers are saved.
                </p>
              )}
            </>
          ) : (
            <>
              <h2 id="next-heading" className="t-h1">Every available mission is complete</h2>
              <p className="mt-3 text-muted prose-measure">Review your debriefs or read the Breach Dossiers while new missions are built.</p>
              <Link href="/dossiers" className="btn btn-quiet mt-6">Open Breach Dossiers</Link>
            </>
          )}
        </section>

        {/* Operator status */}
        <section aria-labelledby="status-heading" className="bg-panel border border-rule rounded-[8px] p-6">
          <h2 id="status-heading" className="t-h3">Operator status</h2>
          <p className="t-h1 mt-3 text-teal">{sum.rank.name}</p>
          <p className="t-small text-muted">{sum.xp.toLocaleString()} XP total</p>
          <div className="mt-4">
            <Meter value={sum.rank.progress} label="Rank progress" />
            <p className="t-micro text-muted mt-1.5">
              {sum.rank.next ? `${(sum.rank.next.minXp - sum.xp).toLocaleString()} XP to ${sum.rank.next.name}` : "Highest rank reached"}
            </p>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-y-3 t-small">
            <dt className="text-muted">Missions</dt>
            <dd className="text-right">{completed} of {sum.cards.length}</dd>
            <dt className="text-muted">Training level</dt>
            <dd className="text-right">{level}: {LEVEL_NAMES[level]}</dd>
            <dt className="text-muted">Achievements</dt>
            <dd className="text-right">{earned.length} of {sum.achievements.length}</dd>
          </dl>
        </section>
      </div>

      <div className="grid gap-6 mt-6 lg:grid-cols-2">
        {drill && (
          <section aria-labelledby="drill-heading" className="border border-rule rounded-[8px] p-5">
            <h2 id="drill-heading" className="t-h3">Today&rsquo;s drill</h2>
            <p className="t-micro text-muted">Rotates daily through missions you haven&rsquo;t finished.</p>
            <Link href={`/missions/${drill.mission.id}`} className="block mt-3 font-medium hover:text-signal">{drill.mission.title}</Link>
            <p className="t-small text-muted mt-1">{drill.mission.summary}</p>
          </section>
        )}
        <section aria-labelledby="brief-heading" className="border border-rule rounded-[8px] p-5">
          <h2 id="brief-heading" className="t-h3">Incident briefing</h2>
          <p className="t-micro text-muted">Dossier {briefing.number}, {briefing.incidentDate}</p>
          <Link href={`/dossiers/${briefing.id}`} className="block mt-3 font-medium hover:text-signal">{briefing.incident}</Link>
          <p className="t-small text-muted mt-1 line-clamp-3">{briefing.historicalBriefing[0]}</p>
        </section>
      </div>

      <div className="grid gap-6 mt-6 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="missions-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="missions-heading" className="t-h2">Missions</h2>
            <Link href="/paths" className="t-small link">All paths</Link>
          </div>
          <ul className="mt-2">
            {sum.cards.map((c) => (
              <MissionRow key={c.mission.id} card={c} />
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          <section aria-labelledby="skills-heading">
            <div className="flex items-baseline justify-between">
              <h2 id="skills-heading" className="t-h2">Skill development</h2>
              <Link href="/skills" className="t-small link">Skill map</Link>
            </div>
            {topSkills.length ? (
              <ul className="mt-3 space-y-3">
                {topSkills.map((s) => (
                  <li key={s.skill}>
                    <div className="flex justify-between t-small">
                      <span>{SKILL_INFO[s.skill].name}</span>
                      <span className="text-muted">{s.level}</span>
                    </div>
                    <Meter value={s.levelIndex / 6} label={`${SKILL_INFO[s.skill].name} mastery`} tone="signal" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="t-small text-muted mt-2">Solve your first objective to start your skill profile.</p>
            )}
          </section>

          <section aria-labelledby="recent-heading">
            <h2 id="recent-heading" className="t-h2">Recently completed</h2>
            {sum.recent.length ? (
              <ul className="mt-2 space-y-2">
                {sum.recent.map((r) => (
                  <li key={r.missionId} className="t-small flex justify-between gap-3">
                    <Link href={`/missions/${r.missionId}/debrief`} className="hover:text-signal">{r.title}</Link>
                    <span className="text-muted shrink-0">{r.independent ? "Independent" : "Assisted"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="t-small text-muted mt-2">Nothing yet. Your debriefs will collect here.</p>
            )}
          </section>

          <section aria-labelledby="ach-heading">
            <h2 id="ach-heading" className="t-h2">Achievements</h2>
            <ul className="mt-2 space-y-1.5">
              {sum.achievements.map((a) => (
                <li key={a.id} className={`t-small flex items-start gap-2 ${a.earnedAt ? "" : "text-faint"}`} title={a.description}>
                  <span aria-hidden="true" className={`mt-1.5 size-2 rounded-full shrink-0 ${a.earnedAt ? "bg-teal" : "border border-faint"}`} />
                  <span>
                    {a.name}
                    <span className="sr-only">{a.earnedAt ? ", earned" : ", not yet earned"}. {a.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
