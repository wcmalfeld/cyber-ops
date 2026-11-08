import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { pruneStaleGuests } from "@/db/guests";
import { authenticate, claimGuestAccount, createGuestUser, hashToken, userForToken } from "@/server/auth";
import { totalXp } from "@/server/game";
import { db, makeUser, pool, resetDatabase } from "./helpers";

beforeAll(resetDatabase);
afterAll(() => pool.end());

const creds = (email: string) => ({ email, password: "correct horse battery", displayName: "Night Owl" });

describe("guest play", () => {
  it("creates a credential-less guest with a generated call sign", async () => {
    const guest = await createGuestUser(db);
    expect(guest.displayName).toMatch(/^Guest-[0-9A-F]{6}$/);
    await db.insert(s.sessions).values({ tokenHash: hashToken("guest-token"), userId: guest.id, expiresAt: new Date(Date.now() + 60_000) });
    expect(await userForToken(db, "guest-token")).toMatchObject({ id: guest.id, email: null, isGuest: true, displayName: guest.displayName });
  });

  it("guests cannot sign in with credentials", async () => {
    await createGuestUser(db);
    expect(await authenticate(db, "", "")).toBeNull();
  });

  it("refuses a non-guest account without credentials", async () => {
    await expect(db.insert(s.users).values({ isGuest: false })).rejects.toThrow();
  });

  it("claims a guest in place, keeping progress", async () => {
    const guest = await createGuestUser(db);
    await db.insert(s.xpTransactions).values({ userId: guest.id, amount: 50, sourceKey: "task:m:t", reason: "test" });

    expect(await claimGuestAccount(db, guest.id, creds("Claimed@Example.test"))).toEqual({ ok: true });

    const [row] = await db.select().from(s.users).where(eq(s.users.id, guest.id));
    expect(row).toMatchObject({ email: "claimed@example.test", isGuest: false });
    expect((await authenticate(db, "claimed@example.test", "correct horse battery"))?.id).toBe(guest.id);
    expect(await totalXp(db, guest.id)).toBe(50);
    const [profile] = await db.select().from(s.userProfiles).where(eq(s.userProfiles.userId, guest.id));
    expect(profile.displayName).toBe("Night Owl");
  });

  it("refuses to claim a taken email or a non-guest account", async () => {
    const guest = await createGuestUser(db);
    expect(await claimGuestAccount(db, guest.id, creds("claimed@example.test"))).toMatchObject({ ok: false });
    const [still] = await db.select().from(s.users).where(eq(s.users.id, guest.id));
    expect(still.isGuest).toBe(true);

    const real = await makeUser();
    expect(await claimGuestAccount(db, real, creds("hijack@example.test"))).toMatchObject({ ok: false });
  });

  it("prunes only stale guests", async () => {
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const stale = await createGuestUser(db);
    const active = await createGuestUser(db);
    const fresh = await createGuestUser(db); // no session yet, but created just now
    const realUser = await makeUser();
    await db.update(s.users).set({ createdAt: old }).where(eq(s.users.id, stale.id));
    await db.update(s.users).set({ createdAt: old }).where(eq(s.users.id, active.id));
    await db.update(s.users).set({ createdAt: old }).where(eq(s.users.id, realUser));
    await db.insert(s.sessions).values([
      { tokenHash: hashToken("stale"), userId: stale.id, expiresAt: new Date(Date.now() - 1000) },
      { tokenHash: hashToken("active"), userId: active.id, expiresAt: new Date(Date.now() + 60_000) },
    ]);

    await pruneStaleGuests(db);

    const remaining = new Set((await db.select({ id: s.users.id }).from(s.users)).map((u) => u.id));
    expect(remaining.has(stale.id)).toBe(false);
    expect(remaining.has(active.id)).toBe(true);
    expect(remaining.has(fresh.id)).toBe(true);
    expect(remaining.has(realUser)).toBe(true);
  });
});
