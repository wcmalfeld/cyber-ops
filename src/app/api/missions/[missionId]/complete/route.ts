import { db } from "@/db";
import { apiHandler } from "@/server/api";
import { completeMission } from "@/server/game";
import { snapshotSkills } from "@/server/profile";

export const POST = apiHandler<{ missionId: string }>({}, async ({ user, params }) => {
  const result = await completeMission(db, user.id, params.missionId);
  if (result.firstCompletion) await snapshotSkills(db, user.id, `mission:${params.missionId}`);
  return result;
});
