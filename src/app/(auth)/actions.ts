"use server";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { authenticate, createSession, destroySession, hashPassword } from "@/server/auth";
import { LIMITS, rateLimit } from "@/server/rate-limit";

export type AuthState = { error?: string; email?: string; displayName?: string };

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() ?? h.get("x-real-ip") ?? "local";
}

const registerSchema = z.object({
  displayName: z.string().trim().min(2, "Call sign must be at least 2 characters").max(40, "Call sign must be 40 characters or fewer"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  password: z.string().min(10, "Password must be at least 10 characters").max(200),
});

export async function register(_: AuthState, form: FormData): Promise<AuthState> {
  const raw = { displayName: String(form.get("displayName") ?? ""), email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") };
  const back = { email: raw.email, displayName: raw.displayName };
  if (!rateLimit(`register:${await clientIp()}`, LIMITS.register).ok) return { ...back, error: "Too many sign-ups from this network. Try again later." };
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { ...back, error: parsed.error.issues[0].message };
  const { displayName, email, password } = parsed.data;
  const [exists] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email));
  if (exists) return { ...back, error: "An account with that email already exists. Sign in instead." };
  const [user] = await db.insert(s.users).values({ email, passwordHash: await hashPassword(password) }).returning();
  await db.insert(s.userProfiles).values({ userId: user.id, displayName });
  await createSession(db, user.id);
  redirect("/");
}

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!rateLimit(`login:${await clientIp()}:${email}`, LIMITS.login).ok)
    return { email, error: "Too many sign-in attempts. Wait 15 minutes and try again." };
  const user = await authenticate(db, email, password);
  if (!user) return { email, error: "Email or password is incorrect." };
  await createSession(db, user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
