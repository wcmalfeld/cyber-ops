import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import * as s from "@/db/schema";
import { authenticate, hashPassword, hashToken, userForToken } from "@/server/auth";
import { sameOrigin } from "@/server/api";
import { rateLimit, resetRateLimits } from "@/server/rate-limit";
import { db, pool, resetDatabase } from "./helpers";

beforeAll(resetDatabase);
afterAll(() => pool.end());

describe("authentication", () => {
  it("verifies passwords with bcrypt and normalizes email", async () => {
    const [u] = await db.insert(s.users).values({ email: "op@example.test", passwordHash: await hashPassword("correct horse battery") }).returning();
    expect((await authenticate(db, "  OP@example.test ", "correct horse battery"))?.id).toBe(u.id);
    expect(await authenticate(db, "op@example.test", "wrong")).toBeNull();
    expect(await authenticate(db, "nobody@example.test", "whatever")).toBeNull();
  });

  it("resolves only unexpired sessions, stored as token hashes", async () => {
    const [u] = await db.insert(s.users).values({ email: "sess@example.test", passwordHash: "x" }).returning();
    await db.insert(s.sessions).values([
      { tokenHash: hashToken("live-token"), userId: u.id, expiresAt: new Date(Date.now() + 60_000) },
      { tokenHash: hashToken("dead-token"), userId: u.id, expiresAt: new Date(Date.now() - 60_000) },
    ]);
    expect((await userForToken(db, "live-token"))?.id).toBe(u.id);
    expect(await userForToken(db, "dead-token")).toBeNull();
    expect(await userForToken(db, hashToken("live-token"))).toBeNull(); // the stored hash is not a usable token
    expect(await userForToken(db, undefined)).toBeNull();
  });
});

describe("request guards", () => {
  const req = (headers: Record<string, string>) => new NextRequest("http://localhost:3000/api/x", { method: "POST", headers });

  it("accepts same-origin and rejects cross-origin writes", () => {
    expect(sameOrigin(req({ origin: "http://localhost:3000", host: "localhost:3000" }))).toBe(true);
    expect(sameOrigin(req({ origin: "https://evil.example", host: "localhost:3000" }))).toBe(false);
    expect(sameOrigin(req({ host: "localhost:3000" }))).toBe(false);
    expect(sameOrigin(req({ host: "localhost:3000", "sec-fetch-site": "same-origin" }))).toBe(true);
  });

  it("rate-limits within a sliding window", () => {
    resetRateLimits();
    const cfg = { limit: 3, windowMs: 1000 };
    const t0 = 1_000_000;
    expect([0, 1, 2].map((i) => rateLimit("k", cfg, t0 + i).ok)).toEqual([true, true, true]);
    const blocked = rateLimit("k", cfg, t0 + 3);
    expect(blocked.ok).toBe(false);
    expect(rateLimit("other", cfg, t0 + 3).ok).toBe(true);
    expect(rateLimit("k", cfg, t0 + 1001).ok).toBe(true);
  });
});
