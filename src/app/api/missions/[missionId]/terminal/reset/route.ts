import { db } from "@/db";
import { apiHandler } from "@/server/api";
import { resetTerminal } from "@/server/game";
import { LIMITS } from "@/server/rate-limit";

export const POST = apiHandler<{ missionId: string }>({ limit: { name: "terminal", ...LIMITS.terminal } }, async ({ user, params }) =>
  resetTerminal(db, user.id, params.missionId),
);
