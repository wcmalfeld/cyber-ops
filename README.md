# CYBER OPS: Colorado

An interactive cybersecurity training platform: investigate simulated incidents with real techniques, get server-validated feedback, and finish every mission with a debrief that explains *why* it happened.

This repository is **Phase 1** of the PRD — the core platform and a reusable mission engine — plus the Phase 2 content foundations (Industry Labs, all six dossier briefings).

## Quick start

Requirements: Node 22+, PostgreSQL 14+.

```bash
cp .env.example .env              # set DATABASE_URL / TEST_DATABASE_URL
createdb cyberops && createdb cyberops_test   # or use your own names
npm install
npm run db:setup                  # migrate + seed content
npm run dev                       # http://localhost:3000
```

Create an account at `/register`. Mission 1 is recommended first.

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server |
| `npm test` | Unit + integration tests (Vitest; integration uses `TEST_DATABASE_URL`) |
| `npm run e2e` | Browser smoke test through the real UI (needs a running server and Chrome; `BASE_URL`, `CHROME` env vars) |
| `node tests/e2e/security.mjs` | Answer-leakage scan of rendered pages + API guard probes |
| `npm run db:migrate` / `db:seed` | Apply migrations / validate and load content. `SEED_ALLOW_OVERWRITE=1` replaces an unchanged-version mission in development |
| `npm run typecheck` / `lint` | TypeScript and ESLint |

## What works today

**Fully functional**
- Accounts (bcrypt, server-side sessions), persistent progress, resume where you left off.
- Mission engine driven entirely by data: missions are validated definitions stored as versioned rows; no mission has its own page or code.
- Six objective types: flag, text answer, single/multi choice, evidence selection (mark log rows), timeline ordering, and terminal observation (auto-solved from what you actually do in the shell).
- **Simulated terminal**: a controlled interpreter over each mission's synthetic filesystem — `ls -la`, `cd`, `cat`, `grep -rinvc`, `find`, `chmod`, `ps`, `strings`, `file`, `stat`, pipes, globbing, real permission checks. State (cwd, chmod changes) is held server-side per user.
- Log viewer (search, filters, click-to-filter, sort, field selection, Denver-time inspection, mark rows, export findings), evidence viewer (TXT/JSON/CSV, SHA-256, line search), timeline builder.
- Server-side validation, objective dependencies, progressive hints (concept → direction → tool → approach) with a gated walkthrough, XP ledger that cannot be farmed, ranks, achievements.
- Skill mastery separate from XP, gated by breadth and difficulty.
- Debriefs with all ten PRD sections; dossier debriefs separate confirmed history from fictionalized elements.
- Mission Control, Training Paths (levels + specialization choice), Breach Dossiers, Industry Labs, Technical Labs, SOC Operations, Skill Profile, Career Center. Responsive and keyboard-accessible.

**Content**
- Mission 1 *Hidden in Plain Sight* (easy, terminal), Mission 2 *Who Logged In?* (easy, log investigation), Mission 3 *The Unlocked Door* (medium, Dossier 001, multi-source correlation + timeline).
- Six dossier briefings with sources. Dossiers 001 and 006 are source-checked; 002–005 are marked "source review pending".
- Seven Colorado company profiles, marked "review pending" until checked against each company's site.

**Clearly marked as planned in the UI**
- Phase 2: playable dossiers 002–006, live SOC alert queue, SIEM query language.
- Phase 3: container-backed Linux labs and vulnerable web apps.
- Phase 4: AI mentor (a `mentor_sessions` table exists; no LLM integration yet).
- Phase 5: NICE Framework mapping, interview mode, shareable reports.

## Layout

```
src/engine/        Pure, framework-free engine: schema, terminal interpreter, validation, progression, client view
src/content/       Authored data: missions, dossiers, companies, skills/careers
src/server/        Server-only services: game (answers/XP/hints/terminal), profile, auth, rate limits, API wrapper
src/db/            Drizzle schema, seed logic
src/app/           Next.js routes (pages + JSON API under /api/missions)
src/components/    UI; workspace/ holds terminal, log viewer, evidence viewer, timeline
tests/             unit/, integration/ (real Postgres), e2e/ (browser)
docs/              ARCHITECTURE.md, SECURITY.md, AUTHORING.md
```

See [`docs/AUTHORING.md`](docs/AUTHORING.md) to add a mission.
