import { MissionRow, PageHeader, Planned } from "@/components/ui";
import { db } from "@/db";
import { requireUser } from "@/server/auth";
import { missionCards } from "@/server/profile";

export const metadata = { title: "Technical Labs" };

export default async function LabsPage() {
  const user = await requireUser();
  const cards = (await missionCards(db, user.id)).filter((c) => c.mission.tools.includes("terminal"));
  return (
    <div className="max-w-5xl">
      <PageHeader title="Technical labs" intro="Hands-on missions in an interactive shell. Today's labs run on a simulated interpreter over a synthetic filesystem — real commands, real permissions, no real host." />
      <section aria-labelledby="avail" className="mb-10">
        <h2 id="avail" className="t-h2">Simulated terminal labs</h2>
        <ul className="mt-2">{cards.map((c) => <MissionRow key={c.mission.id} card={c} />)}</ul>
      </section>
      <section aria-labelledby="cmds" className="mb-10">
        <h2 id="cmds" className="t-h2">Supported commands</h2>
        <p className="t-small text-muted mt-1 prose-measure">Core set in every lab, plus tools individual missions enable. Pipes work; redirection and command chaining are intentionally unsupported.</p>
        <p className="data mt-3 text-muted leading-loose">pwd ls cd cat less head tail grep find file stat strings chmod whoami id ps history clear help</p>
        <p className="t-small text-muted mt-2">Mission-enabled: <span className="data">base64 wc sort uniq echo</span></p>
      </section>
      <Planned phase="Phase 3">Isolated, disposable Linux containers and vulnerable web applications per user session, with no outbound internet, resource limits, and automatic teardown.</Planned>
    </div>
  );
}
