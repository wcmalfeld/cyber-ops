# Architecture

## Layers

| Concern (PRD §14) | Where | Notes |
|---|---|---|
| User interface | `src/app`, `src/components` | Server Components render pages; only the workspace tools are client components. |
| Authentication | `src/server/auth.ts`, `src/app/(auth)` | bcrypt (cost 12), opaque 32-byte session tokens; only their SHA-256 is stored. |
| User progression | `src/server/game.ts`, `src/server/profile.ts`, `src/engine/progression.ts` | XP is a ledger; mastery is computed from task progress. |
| Challenge definitions | `src/engine/schema.ts`, `src/content/missions` | Zod schema; definitions seeded into `mission_versions`. |
| Mission execution | `src/server/game.ts` | Start, submit, hint, terminal, complete. |
| Flag/answer validation | `src/engine/validate.ts` | Deterministic, server-only. |
| Evidence management | `missions.evidence` in the definition; `GET /api/missions/:id/evidence/:eid` | Served only after the mission is started. |
| Lab execution | `src/engine/terminal`, `lab_sessions` table | MVP: simulated interpreter. Phase 3 adds container-backed `kind`s. |
| AI mentor | `mentor_sessions` table only | Phase 4. Must stay separate from deterministic scoring. |
| Content management | seed script + DB records | Companies and dossiers are DB rows the UI reads; edit and re-seed. |

## Key decisions

**Missions are data, versioned and immutable.** `npm run db:seed` validates every definition and writes it to `mission_versions` with a checksum. Changing a definition without bumping `version` fails the seed (unless `SEED_ALLOW_OVERWRITE=1` in development). An attempt records the version it started on, and play/debrief always load that version — so content edits never corrupt in-flight progress.

**The client gets an allow-list view.** `toClientMission()` builds the client shape field by field. Flags, accepted answers, correct options, required rows, orderings (shuffled deterministically), hint text, solutions, terminal file contents, evidence contents and debriefs are never in it. A unit test asserts this for every mission; `tests/e2e/security.mjs` checks rendered pages.

**The terminal runs on the server.** Commands are POSTed and evaluated by `execute(env, state, input)` — a pure function over the mission's virtual filesystem plus a per-user overlay (cwd, chmod changes, observations). File contents never ship to the browser in bulk, and observation objectives ("list hidden files") are judged from server-held state the user cannot forge.

**Exactly-once scoring.** A task is solved via `UPDATE … WHERE solved_at IS NULL RETURNING`; XP is inserted into `xp_transactions` with a unique `(user_id, source_key)`. Concurrent or repeated correct answers award once (tested).

**Hints never punish help-seeking.** Each hint costs 10% of the objective's XP (floor 50%); a revealed walkthrough earns 25%. The walkthrough unlocks after all four hints *and* three genuine attempts, or after solving. After a task is solved, all hints and the walkthrough are visible for review with no scoring effect.

**Mastery ≠ XP.** Mastery points = weight × difficulty factor × independence factor. Levels also require evidence from N distinct missions and an independently solved task of a minimum difficulty, so repetition at one difficulty cannot inflate it.

## Rendering

Next.js 16 enables Cache Components by default. Nearly every route here is per-user and session-bound, so it is disabled (`next.config.ts`) and pages render at request time. Revisit if public, cacheable pages (marketing, dossier library) are added.

## Data model

See `src/db/schema.ts` (migration in `drizzle/`). PRD §14.3 entity mapping:

- Users, profiles, sessions → `users`, `user_profiles`, `sessions`
- Missions, versions, categories → `missions`, `mission_versions`, `challenge_categories`
- Objectives, evidence, flags → `mission_objectives`, `mission_evidence` (indexes of each version; flag values live only in the definition)
- Attempts, submissions, completions → `mission_attempts`, `submissions`, `mission_completions`, per-task `task_progress`
- Hints → `hint_reveals`; XP → `xp_transactions`; ranks are derived from XP (no table)
- Achievements → `achievements`, `user_achievements`; skills → `skill_definitions`, `skill_assessments` (snapshots at completion)
- Companies, dossiers, sources → `company_profiles`, `breach_dossiers`, `source_references`
- Labs, mentor → `lab_sessions`, `mentor_sessions`

## Phase 3 note

`lab_sessions.kind` is the seam for real labs. A container-backed lab should implement the same contract as the simulated terminal (`input → output + observed events`) so observation objectives keep working, and must meet `docs/SECURITY.md` §Advanced labs before any user can reach it.
