# Authoring a mission

1. Create `src/content/missions/<id>.ts` exporting a `MissionInput` (see the three existing missions — each shows a different pattern).
2. Register it in `src/content/missions/index.ts`.
3. Run `npm test` (validates the schema and checks no answer leaks into the client view) and `npm run db:seed`.

No pages, routes or components are needed.

## Building blocks

- **tools**: any of `terminal`, `log_viewer`, `evidence_viewer`, `timeline_builder`.
- **terminal**: user, groups, home, files (path, content, mode, owner, `binary`, `fileType`), dirs, processes, seeded history, and `extraCommands` (`base64`, `wc`, `sort`, `uniq`, `echo`). Content may not contain NUL characters.
- **evidence**: `csv` (set `rowIdColumn` for selectable rows and `timestampColumn` for time inspection), `json`, `txt`, `log`.
- **tasks** (`kind`):
  - `flag` — `flags: ["CYBEROPS{...}"]`
  - `text` — `accept`, optional `caseSensitive`, `feedback` for predictable wrong answers
  - `choice` — `options` (each wrong option should have `whyWrong`), `correct`, `multi`
  - `evidence_select` — `evidenceId`, `required` row ids, `maxSelections`
  - `ordering` — `items`, `correctOrder`
  - `terminal_observation` — `condition`: `read_file`, `listed_hidden` or `used_command`
- Every task needs exactly four `hints` (concept → direction → tool → approach), a `solution`, an `explanation`, `xp` and weighted `skills`. Use `requires` for objectives that unlock others.
- **debrief**: all ten PRD §11 sections. Backticks render as inline code.

## Rules

- Feedback and hints must never contain the answer verbatim until the walkthrough.
- Evidence is synthetic: use `.example` domains and RFC 5737 / RFC 1918 addresses.
- For a Breach Dossier mission, set `dossierId` and keep historical facts in `src/content/dossiers.ts` with sources and a `factCheck` status — never in the mission's evidence.
- Changing a published mission? Bump `version`. Existing attempts keep playing their original version.
- Prefer computing answers from generated data (see `who-logged-in.ts`) and asserting them in a test.
