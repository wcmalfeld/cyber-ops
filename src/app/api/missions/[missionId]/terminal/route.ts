import { z } from "zod";
import { db } from "@/db";
import { MAX_INPUT_LENGTH } from "@/engine/terminal/interpreter";
import { apiHandler } from "@/server/api";
import { runTerminalCommand } from "@/server/game";
import { LIMITS } from "@/server/rate-limit";

const body = z.object({ input: z.string().max(MAX_INPUT_LENGTH * 2) });

export const POST = apiHandler<{ missionId: string }>({ limit: { name: "terminal", ...LIMITS.terminal } }, async ({ user, params, body: raw }) => {
  const { input } = body.parse(raw);
  return runTerminalCommand(db, user.id, params.missionId, input);
});
