import { notFound, redirect } from "next/navigation";
import { Workspace } from "@/components/workspace/workspace";
import { db } from "@/db";
import { toClientMission } from "@/engine/client-view";
import { requireUser } from "@/server/auth";
import { getAttempt, getMissionProgress, terminalSnapshot } from "@/server/game";
import { getMission } from "@/server/missions-repo";

export async function generateMetadata({ params }: { params: Promise<{ missionId: string }> }) {
  const m = await getMission(db, (await params).missionId);
  return { title: m ? `${m.title} workspace` : "Workspace" };
}

export default async function PlayPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params;
  const user = await requireUser();
  const attempt = await getAttempt(db, user.id, missionId);
  if (!attempt) redirect(`/missions/${missionId}`);
  // Play the exact version the attempt started on.
  const mission = await getMission(db, missionId, attempt.version);
  if (!mission) notFound();
  const [progress, term] = await Promise.all([getMissionProgress(db, user.id, mission), terminalSnapshot(db, user.id, mission)]);
  return (
    <Workspace
      mission={toClientMission(mission)}
      initialProgress={progress.tasks}
      completed={attempt.status === "completed"}
      terminal={term}
    />
  );
}
