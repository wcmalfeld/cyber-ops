import { db } from "@/db";
import { submissionSchema } from "@/engine/validate";
import { apiHandler } from "@/server/api";
import { submitAnswer } from "@/server/game";
import { LIMITS } from "@/server/rate-limit";

export const POST = apiHandler<{ missionId: string; taskId: string }>(
  { limit: { name: "submit", ...LIMITS.submit } },
  async ({ user, params, body }) => submitAnswer(db, user.id, params.missionId, params.taskId, submissionSchema.parse(body)),
);
