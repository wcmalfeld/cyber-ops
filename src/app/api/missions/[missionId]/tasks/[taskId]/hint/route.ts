import { db } from "@/db";
import { apiHandler } from "@/server/api";
import { revealHint } from "@/server/game";
import { LIMITS } from "@/server/rate-limit";

export const POST = apiHandler<{ missionId: string; taskId: string }>({ limit: { name: "hint", ...LIMITS.hint } }, async ({ user, params }) =>
  revealHint(db, user.id, params.missionId, params.taskId),
);
