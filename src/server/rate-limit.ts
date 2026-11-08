import "server-only";
/**
 * Sliding-window rate limiter (in-process). Adequate for a single instance; swap the
 * store for Redis/Postgres before running multiple instances. See docs/SECURITY.md.
 */
const buckets = new Map<string, number[]>();
let lastSweep = Date.now();

export const LIMITS = {
  submit: { limit: 20, windowMs: 60_000 },
  terminal: { limit: 120, windowMs: 60_000 },
  hint: { limit: 30, windowMs: 60_000 },
  login: { limit: 8, windowMs: 15 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000 },
} as const;

export function rateLimit(key: string, { limit, windowMs }: { limit: number; windowMs: number }, now = Date.now()) {
  if (now - lastSweep > 60_000) {
    for (const [k, v] of buckets) if (!v.length || now - v[v.length - 1] > 60 * 60_000) buckets.delete(k);
    lastSweep = now;
  }
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { ok: false as const, retryAfterSec: Math.ceil((windowMs - (now - hits[0])) / 1000) };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { ok: true as const, remaining: limit - hits.length };
}

export function resetRateLimits() {
  buckets.clear();
}
