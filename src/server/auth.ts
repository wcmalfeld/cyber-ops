import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, type DB } from "@/db";
import * as s from "@/db/schema";

export const SESSION_COOKIE = "cyberops_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BCRYPT_COST = 12;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const hashPassword = (pw: string) => bcrypt.hash(pw, BCRYPT_COST);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

// A real bcrypt hash of a random string: comparing against it keeps login timing
// identical whether or not the email exists.
const DUMMY_HASH = "$2b$12$Dy1cbZ29nJpodTWPC.Ll6.IiMHkxqSEOtKFHpptQrPFy6jMakuzQG";

export async function authenticate(database: DB, email: string, password: string) {
  const [user] = await database.select().from(s.users).where(eq(s.users.email, email.toLowerCase().trim()));
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  return ok && user ? user : null;
}

export async function createSession(database: DB, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await database.insert(s.sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  await database.delete(s.sessions).where(and(eq(s.sessions.userId, userId), lt(s.sessions.expiresAt, new Date())));
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function userForToken(database: DB, token: string | undefined) {
  if (!token || token.length > 100) return null;
  const [row] = await database
    .select({ id: s.users.id, email: s.users.email, isGuest: s.users.isGuest, displayName: s.userProfiles.displayName })
    .from(s.sessions)
    .innerJoin(s.users, eq(s.users.id, s.sessions.userId))
    .leftJoin(s.userProfiles, eq(s.userProfiles.userId, s.users.id))
    .where(and(eq(s.sessions.tokenHash, hashToken(token)), gt(s.sessions.expiresAt, new Date())));
  return row ?? null;
}

// ── guests ─────────────────────────────────────────────────────────────────

/** Creates a credential-less guest user with a generated call sign. */
export async function createGuestUser(database: DB) {
  const [user] = await database.insert(s.users).values({ isGuest: true }).returning({ id: s.users.id });
  const callSign = `Guest-${randomBytes(3).toString("hex").toUpperCase()}`;
  await database.insert(s.userProfiles).values({ userId: user.id, displayName: callSign });
  return { id: user.id, displayName: callSign };
}

export type ClaimResult = { ok: true } | { ok: false; error: string };

/**
 * Turns a guest into a full account in place, so every row keyed by user id (progress,
 * XP, achievements) carries over. Only a still-guest row can be claimed.
 */
export async function claimGuestAccount(
  database: DB,
  userId: string,
  input: { email: string; password: string; displayName: string },
): Promise<ClaimResult> {
  const email = input.email.toLowerCase().trim();
  const [taken] = await database.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email));
  if (taken) return { ok: false, error: "An account with that email already exists." };
  const passwordHash = await hashPassword(input.password);
  try {
    const claimed = await database
      .update(s.users)
      .set({ email, passwordHash, isGuest: false })
      .where(and(eq(s.users.id, userId), eq(s.users.isGuest, true)))
      .returning({ id: s.users.id });
    if (!claimed.length) return { ok: false, error: "This session is not a guest session." };
  } catch (e) {
    // Lost a race with another sign-up for the same email (unique violation).
    if ((e as { code?: string }).code === "23505" || (e as { cause?: { code?: string } }).cause?.code === "23505")
      return { ok: false, error: "An account with that email already exists." };
    throw e;
  }
  await database.update(s.userProfiles).set({ displayName: input.displayName }).where(eq(s.userProfiles.userId, userId));
  return { ok: true };
}

/** Current user for this request (deduplicated per render). */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return userForToken(db, token);
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Ends the current session row (used to rotate the token on privilege change). */
export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(s.sessions).where(eq(s.sessions.tokenHash, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}
