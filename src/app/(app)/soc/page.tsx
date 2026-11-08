import { MissionRow, PageHeader, Planned } from "@/components/ui";
import { db } from "@/db";
import { requireUser } from "@/server/auth";
import { missionCards } from "@/server/profile";

export const metadata = { title: "SOC Operations" };

export default async function SocPage() {
  const user = await requireUser();
  const cards = (await missionCards(db, user.id)).filter((c) => c.mission.path === "soc" || c.mission.tools.includes("log_viewer"));
  return (
    <div className="max-w-5xl">
      <PageHeader title="SOC operations" intro="Blue-team investigations: triage alerts, read authentication and network logs, correlate evidence, and decide how to respond." />
      <section aria-labelledby="inv" className="mb-10">
        <h2 id="inv" className="t-h2">Investigations</h2>
        <ul className="mt-2">{cards.map((c) => <MissionRow key={c.mission.id} card={c} />)}</ul>
      </section>
      <Planned phase="Phase 2">A live alert queue where you decide which alerts are true positives, plus a SIEM-style query language in the log viewer.</Planned>
    </div>
  );
}
