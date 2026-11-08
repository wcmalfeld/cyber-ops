import { Meter, PageHeader } from "@/components/ui";
import { SKILL_INFO } from "@/content/catalog";
import { db } from "@/db";
import { MASTERY_LEVELS } from "@/engine/progression";
import { requireUser } from "@/server/auth";
import { skillMasteries } from "@/server/profile";

export const metadata = { title: "Skill Profile" };

export default async function SkillsPage() {
  const user = await requireUser();
  const skills = await skillMasteries(db, user.id);
  const sorted = [...skills].sort((a, b) => b.score - a.score || a.skill.localeCompare(b.skill));
  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Skill profile"
        intro="Mastery is measured separately from XP. It grows with demonstrated, independent work — and higher levels require evidence from several missions and harder objectives, so repetition alone can't inflate it."
      />
      <section aria-labelledby="map" className="mb-12">
        <h2 id="map" className="sr-only">Skill map</h2>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[40rem] border-collapse">
            <thead>
              <tr className="t-micro text-muted text-left">
                <th scope="col" className="py-2 font-normal w-52">Skill</th>
                {MASTERY_LEVELS.slice(1).map((l) => <th key={l.name} scope="col" className="py-2 font-normal text-center">{l.name}</th>)}
                <th scope="col" className="py-2 font-normal text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.skill} className="border-t border-rule">
                  <th scope="row" className="py-3 text-left font-normal">
                    <span className="block t-small">{SKILL_INFO[s.skill].name}</span>
                    <span className="block t-micro text-muted">{s.missions ? `${s.missions} mission${s.missions > 1 ? "s" : ""}` : "No evidence yet"}</span>
                  </th>
                  {MASTERY_LEVELS.slice(1).map((l, i) => (
                    <td key={l.name} className="py-3 px-1">
                      <span
                        className={`block h-2.5 rounded-[2px] ${i + 1 <= s.levelIndex ? "bg-teal" : "bg-rule/70"}`}
                        aria-hidden="true"
                      />
                    </td>
                  ))}
                  <td className="py-3 text-right t-small">
                    <span className="sr-only">{s.level}, </span>{s.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="next">
        <h2 id="next" className="t-h2">What moves each skill forward</h2>
        <ul className="mt-4 grid gap-5 sm:grid-cols-2">
          {sorted.filter((s) => s.score > 0).map((s) => (
            <li key={s.skill}>
              <div className="flex justify-between t-small"><span>{SKILL_INFO[s.skill].name}</span><span className="text-teal">{s.level}</span></div>
              <Meter value={s.levelIndex / 6} label={`${SKILL_INFO[s.skill].name} mastery`} tone="signal" />
              <p className="t-micro text-muted mt-1">{s.nextRequirement ?? "Highest level reached."}</p>
            </li>
          ))}
        </ul>
        {!sorted.some((s) => s.score > 0) && <p className="t-small text-muted mt-2">Solve an objective in any mission to start building evidence.</p>}
      </section>
    </div>
  );
}
