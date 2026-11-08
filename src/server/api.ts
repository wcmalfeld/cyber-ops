import "server-only";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { db } from "@/db";
import { SESSION_COOKIE, userForToken } from "./auth";
import { GameError } from "./game";
import { rateLimit } from "./rate-limit";

type User = NonNullable<Awaited<ReturnType<typeof userForToken>>>;

/**
 * Same-origin check for state-changing requests. Combined with SameSite=Lax session
 * cookies and JSON-only bodies, this blocks cross-site request forgery.
 */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "same-origin";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Wraps a JSON API handler with origin check, auth, rate limiting and error mapping. */
export function apiHandler<P>(
  opts: { limit?: { name: string; limit: number; windowMs: number } },
  handler: (ctx: { req: NextRequest; user: User; params: P; body: unknown }) => Promise<unknown>,
) {
  return async (req: NextRequest, route: { params: Promise<P> }) => {
    if (req.method !== "GET" && !sameOrigin(req)) return json({ error: "Cross-origin request blocked" }, 403);
    const user = await userForToken(db, (await cookies()).get(SESSION_COOKIE)?.value);
    if (!user) return json({ error: "Not signed in" }, 401);
    if (opts.limit) {
      const rl = rateLimit(`${opts.limit.name}:${user.id}`, opts.limit);
      if (!rl.ok)
        return NextResponse.json({ error: `Too many requests — try again in ${rl.retryAfterSec}s` }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
    }
    let body: unknown = undefined;
    if (req.method !== "GET") {
      if (!req.headers.get("content-type")?.includes("application/json")) return json({ error: "Expected application/json" }, 415);
      const text = await req.text();
      if (text.length > 16_384) return json({ error: "Request too large" }, 413);
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        return json({ error: "Invalid JSON" }, 400);
      }
    }
    try {
      return json(await handler({ req, user, params: await route.params, body }));
    } catch (e) {
      if (e instanceof GameError) return json({ error: e.message }, e.status);
      if (e instanceof ZodError) return json({ error: "Invalid request", issues: e.issues.map((i) => i.message) }, 400);
      console.error(e);
      return json({ error: "Internal error" }, 500);
    }
  };
}
