import { Nav } from "@/components/nav";
import { Meter } from "@/components/ui";
import { db } from "@/db";
import { rankFor } from "@/engine/progression";
import { requireUser } from "@/server/auth";
import { totalXp } from "@/server/game";
import { logout } from "../(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const xp = await totalXp(db, user.id);
  const rank = rankFor(xp);
  return (
    <div className="lg:flex min-h-dvh">
      <Nav
        footer={
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="t-small font-medium truncate">{user.displayName ?? "Operator"}</span>
              <span className="t-micro text-muted shrink-0">{xp.toLocaleString()} XP</span>
            </div>
            <p className="t-micro text-teal">{rank.name}</p>
            <Meter value={rank.progress} label={`Progress to ${rank.next?.name ?? "max rank"}`} />
            <form action={logout}>
              <button className="t-micro text-muted hover:text-ink underline underline-offset-2">Sign out</button>
            </form>
          </div>
        }
      />
      <main id="main" className="flex-1 min-w-0 px-4 sm:px-8 py-8 lg:py-10">{children}</main>
    </div>
  );
}
