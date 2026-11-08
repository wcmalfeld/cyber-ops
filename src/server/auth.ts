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
    .select({ id: s.users.id, email: s.users.email, displayName: s.userProfiles.displayName })
    .from(s.sessions)
    .innerJoin(s.users, eq(s.users.id, s.sessions.userId))
    .leftJoin(s.userProfiles, eq(s.userProfiles.userId, s.users.id))
    .where(and(eq(s.sessions.tokenHash, hashToken(token)), gt(s.sessions.expiresAt, new Date())));
  return row ?? null;
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

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(s.sessions).where(eq(s.sessions.tokenHash, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}
