import { db } from "@/db";
import { apiHandler } from "@/server/api";
import { GameError, getAttempt } from "@/server/game";
import { getMission } from "@/server/missions-repo";

/** Evidence is the investigation material itself — available once a mission is started. */
export const GET = apiHandler<{ missionId: string; evidenceId: string }>({}, async ({ user, params }) => {
  const attempt = await getAttempt(db, user.id, params.missionId);
  if (!attempt) throw new GameError("Start the mission first", 409);
  const mission = await getMission(db, params.missionId, attempt.version);
  const ev = mission?.evidence.find((e) => e.id === params.evidenceId);
  if (!ev) throw new GameError("Evidence not found", 404);
  return { id: ev.id, name: ev.name, format: ev.format, content: ev.content };
});
