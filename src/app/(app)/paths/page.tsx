import { MissionRow, PageHeader } from "@/components/ui";
import { LEVEL_REQUIREMENTS, PATH_INFO } from "@/content/catalog";
import { db } from "@/db";
import { PATHS } from "@/engine/schema";
import { LEVEL_NAMES } from "@/engine/progression";
import { requireUser } from "@/server/auth";
import { userSummary } from "@/server/profile";
import { choosePath } from "./actions";

export const metadata = { title: "Training Paths" };

export default async function PathsPage() {
  const user = await requireUser();
  const sum = await userSummary(db, user.id);
  const current = sum.currentPath;

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Training paths"
        intro="Six levels from orientation to specialist. Levels suggest an order, but nothing here is gated behind finishing everything before it — explore any unlocked mission."
      />

      <section aria-labelledby="spec-heading" className="mb-12">
        <h2 id="spec-heading" className="t-h2">Your specialization</h2>
        <p className="t-small text-muted mt-1">Choose a focus. It shapes recommendations and your career profile; you can change it any time.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PATHS.map((p) => {
            const count = sum.cards.filter((c) => c.mission.path === p).length;
            const selected = current === p;
            return (
              <li key={p}>
                <form action={choosePath} className="h-full">
                  <input type="hidden" name="path" value={p} />
                  <button
                    aria-pressed={selected}
                    className={`h-full w-full text-left p-4 rounded-[6px] border transition-colors ${selected ? "border-teal bg-teal/10" : "border-rule hover:bg-raised"}`}
                  >
                    <span className="block font-medium">{PATH_INFO[p].name}</span>
                    <span className="block t-small text-muted mt-1">{PATH_INFO[p].focus}</span>
                    <span className="block t-micro mt-3 text-muted">
                      {selected ? <span className="text-teal">Current focus</span> : count ? `${count} mission${count > 1 ? "s" : ""} available` : "Missions in development"}
                    </span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      <ol className="space-y-10">
        {LEVEL_REQUIREMENTS.map((lv) => {
          const cards = sum.cards.filter((c) => c.mission.level === lv.level);
          return (
            <li key={lv.level} aria-labelledby={`lvl-${lv.level}`} className="grid gap-4 md:grid-cols-[12rem_1fr]">
              <div>
                <p className="data text-faint">Level {lv.level}</p>
                <h2 id={`lvl-${lv.level}`} className="t-h2">{LEVEL_NAMES[lv.level]}</h2>
                <dl className="t-micro text-muted mt-2 space-y-1.5">
                  <div><dt className="inline text-ink">Expects: </dt><dd className="inline">{lv.expects}</dd></div>
                  <div><dt className="inline text-ink">To advance: </dt><dd className="inline">{lv.completion}</dd></div>
                </dl>
              </div>
              <div className="border-t border-rule md:border-t-0 md:border-l md:pl-6">
                {cards.length ? (
                  <ul>{cards.map((c) => <MissionRow key={c.mission.id} card={c} />)}</ul>
                ) : (
                  <p className="t-small text-faint py-3.5">No missions at this level yet. The mission engine is ready for them; content is in development.</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
