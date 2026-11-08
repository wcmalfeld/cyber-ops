/**
 * Mission registry. To add a mission: write a definition file and list it here.
 * `npm run db:seed` validates every definition against the schema and stores it as
 * a versioned row in `mission_versions`; the app serves missions from the database.
 */
import { missionSchema, type Mission, type MissionInput } from "@/engine/schema";
import { hiddenInPlainSight } from "./hidden-in-plain-sight";
import { theUnlockedDoor } from "./the-unlocked-door";
import { whoLoggedIn } from "./who-logged-in";

export const MISSION_SOURCES: MissionInput[] = [hiddenInPlainSight, whoLoggedIn, theUnlockedDoor];

/** Parse and validate every authored mission. Throws with the mission id on failure. */
export function loadAuthoredMissions(): Mission[] {
  return MISSION_SOURCES.map((src) => {
    const res = missionSchema.safeParse(src);
    if (!res.success) throw new Error(`Mission ${src.id} is invalid:\n${res.error.message}`);
    return res.data;
  });
}
