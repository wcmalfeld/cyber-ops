import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { createDb } from "@/db/client";
import * as s from "@/db/schema";
import { seedContent } from "@/db/seed-lib";

export const { db, pool } = createDb(process.env.TEST_DATABASE_URL);

export async function resetDatabase() {
  await db.execute(sql`TRUNCATE users, sessions, mission_attempts, task_progress, submissions, hint_reveals, xp_transactions, mission_completions, user_achievements, skill_assessments, lab_sessions CASCADE`);
  await seedContent(db);
}

export async function makeUser(name = "Test Operator") {
  const [u] = await db
    .insert(s.users)
    .values({ email: `${randomUUID()}@example.test`, passwordHash: "x" })
    .returning();
  await db.insert(s.userProfiles).values({ userId: u.id, displayName: name });
  return u.id;
}
