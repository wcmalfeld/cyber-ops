# Security

## Controls in place

| Area | Control | Verified by |
|---|---|---|
| Answer validation | All correctness decided server-side from the stored definition; client sends only answers | `tests/integration/game.test.ts` |
| Answer leakage | Allow-list client view; evidence served only after start; debrief only after completion | `tests/unit/engine.test.ts`, `tests/e2e/security.mjs` |
| Forged completion | `/complete` checks every objective's `solved_at`; request body ignored | integration test, security smoke (409) |
| XP farming | Solve-once guard + unique XP ledger key | integration test (concurrent submissions) |
| Wrong-mission answers | Submissions bound to `(mission, task)`; unknown task ids rejected | integration test |
| Brute force | Sliding-window limits: submit 20/min, terminal 120/min, hint 30/min per user; login 8/15 min per IP+email; register 5/h per IP | unit test, security smoke (429) |
| CSRF | SameSite=Lax cookie, JSON-only API bodies, Origin/Sec-Fetch-Site check; Server Actions' built-in origin check | `tests/integration/auth.test.ts` |
| Sessions | 32 random bytes, httpOnly, Secure in production, 30-day expiry; DB stores SHA-256 only; logout deletes the row | auth test |
| Passwords | bcrypt cost 12, ≥10 chars; constant-time path for unknown emails | auth test |
| Terminal | No process execution; pure interpreter over synthetic data; redirection/chaining/substitution rejected; input 500 chars, output 64 KB; grep patterns length-capped and nested quantifiers refused (ReDoS) | `tests/unit/terminal.test.ts` |
| Input validation | Zod on every API body; 16 KB body cap | security smoke (400) |
| Headers | nosniff, frame DENY, strict referrer, restrictive Permissions-Policy, no X-Powered-By | `next.config.ts` |
| Data | All organizations, people, IPs (RFC 1918/5737) and credentials are synthetic | content review |

## Known limitations before production

- **Rate limiting is in-process.** Correct for one instance; move the store to Redis or Postgres before scaling horizontally.
- **No CSP yet.** Add a nonce-based Content-Security-Policy (see Next's `content-security-policy` guide).
- **No email verification or password reset.**
- **Static flags.** Flags are the same for every user (PRD §7.3 defers per-user generated flags).
- **Session revocation** on password change isn't implemented (no password change flow yet).

## Advanced labs (Phase 3) — required before launch

Disposable per-session containers or VMs; no outbound internet by default; block cloud metadata endpoints; CPU/memory/disk/time limits; non-root execution; no host mounts; network segmentation; automatic teardown and reset; audit log of the lab lifecycle. No intentionally vulnerable service may be reachable from the public internet.
