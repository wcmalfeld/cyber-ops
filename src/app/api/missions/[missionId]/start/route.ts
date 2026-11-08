import { db } from "@/db";
import { apiHandler } from "@/server/api";
import { startMission } from "@/server/game";

export const POST = apiHandler<{ missionId: string }>({}, async ({ user, params }) => {
  const attempt = await startMission(db, user.id, params.missionId);
  return { status: attempt?.status, version: attempt?.version };
});
