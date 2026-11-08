"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import * as s from "@/db/schema";
import { pathSchema } from "@/engine/schema";
import { requireUser } from "@/server/auth";

export async function choosePath(form: FormData) {
  const user = await requireUser();
  const parsed = pathSchema.safeParse(form.get("path"));
  if (!parsed.success) return;
  await db.update(s.userProfiles).set({ currentPath: parsed.data }).where(eq(s.userProfiles.userId, user.id));
  revalidatePath("/paths");
  revalidatePath("/");
}
