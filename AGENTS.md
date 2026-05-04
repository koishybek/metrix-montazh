# AGENTS.md — Metrix Installer Pro Project Rules

## Project background

This is a **brownfield project** — partially built earlier by another AI for IoT-Exponenta (Kazakhstan, IoT meter installation). The PWA is used by field installers to register newly installed water/gas/heat meters into Smart Metrix admin at `sm.iot-exp.kz`.

The previous AI session left the project **broken in specific places**: hardcoded fields that should be dynamic, mojibake (UTF-8 strings saved as Latin-1) in user-facing messages, missing required API fields, wrong node IDs for hot water resource. UI looks correct, plumbing is leaky.

The product owner has 2+ years experience with this domain. **Trust their input over Swagger or your guesses.**

## Authoritative context (READ EVERY SESSION)

1. `.agents/skills/metrix-context/SKILL.md` — real production POST payload, auto-node logic, port_mode endpoint, locked product decisions
2. `.agents/skills/metrix-context/reference/api-spec.md` — full Smart Metrix Swagger (use as REFERENCE, not source of truth — captured payload in SKILL.md is)
3. `docs/screenshots/` — current UI state of working form
4. `docs/audit/` — known issues catalogued (after first audit session)

If code contradicts SKILL.md, **the docs are correct**, the code is the bug.

## Stack (current, do NOT change without ADR)

- React 18 + TypeScript + Vite 7
- Tailwind CSS 3
- React Router v7
- **axios** with interceptors (do NOT replace with fetch/react-query)
- **React Context API** (AuthContext) — do NOT replace with Redux/Zustand
- vite-plugin-pwa
- lucide-react, date-fns, html5-qrcode
- Yandex Geocoder API (street search)
- localStorage (drafts, token persistence)

## Forbidden practices

- **Do not introduce** new state mgmt (Redux, Zustand, MobX, TanStack Query) — Context + axios works for them
- **Do not introduce** new HTTP client — axios stays
- **Do not introduce** Firebase, Supabase, BaaS — backend IS sm.iot-exp.kz
- **Do not commit** tokens/credentials. Use `.env.local` (gitignored)
- **Do not rewrite** the form structure unless the audit doc explicitly says so
- **Do not delete** `streets.json`, `meterModels.ts` without product owner approval (they may want them as offline fallback)

## ⛔ FORBIDDEN COMMANDS

Previous AI sessions destroyed working files. Strict rules:

1. **NEVER use `--overwrite`** with scaffolders if there are existing files
2. **NEVER use `--force` / `-f`** with `rm`, `Remove-Item`, `git clean`, `git reset --hard` without listing what will be deleted, getting explicit user confirmation, and verifying recent git commit
3. **NEVER scaffold into a non-empty directory** — use temp subdirectory then merge manually
4. **ALWAYS commit before risky operations**:
   ```powershell
   git add .
   git commit -m "wip: before <operation>"
   ```
5. **Files that NEVER get deleted without explicit user OK:**
   - `AGENTS.md`, `.env*`, `.agents/`, `docs/`
   - `src/pages/*.tsx` (verify with `git log <file>` before any delete)
   - `.gitignore` (append only, never replace)

## Diagnostic-first principle

Before any fix:
1. Read the relevant existing file fully
2. Cross-reference behavior with `SKILL.md` real payload spec
3. If you find a discrepancy — write it in `docs/audit/` as a finding, then fix
4. If "fix" requires touching 5+ files — STOP, write a plan in `docs/plans/`, get approval
5. One slice = one commit. Conventional Commits in English (feat/fix/refactor/docs/chore/test)

## Mojibake awareness

The codebase contains UTF-8 Russian strings that have been corrupted to Latin-1 mojibake (e.g. "РЎРµСЂРёР№РЅС‹Р№" instead of "Серийный"). When fixing:
- Replace mojibake strings with proper Cyrillic
- Save files as UTF-8 with BOM if necessary on Windows
- Verify in browser that text renders correctly after edit
- Common file types affected: `*.tsx` (alert() calls, placeholders), `assets/streets.json` (key names), `assets/meterModels.ts` (descriptions)

## Required practices

- All new UI text in Russian (ru-RU), Cyrillic encoding (NOT mojibake)
- All commits in English, Conventional Commits
- Every architectural decision → `docs/adr/XXX-title.md`
- Every multi-file plan → `docs/plans/<task>.md` before executing
- Run `npm run build` (it includes typecheck) before marking task done
- Manual verification in browser before saying "done" — do not trust your own typecheck/lint pass alone

## Product decisions (LOCKED)

These are settled by the owner (2yr+ domain experience). Do not revisit:

- **Auth:** keep existing AuthContext + token in localStorage. Login screen stays.
- **No photos sent to API:** photo capture UI may stay as installer's local memo, but they are NOT included in POST `/api/v1/meter/` payload
- **Single-page form** for new installation. NO wizard.
- **Auto-node for water:** ХВС → node 20, ГВС → node **79** (NOT 21 — that's a bug in current code)
- **Drafts:** keep existing localStorage system
- **QR scanner:** keep html5-qrcode (works)
- **Yandex Geocoder:** keep, but fix encoding bugs
- **CORS:** prod deploy needs backend whitelist OR same subdomain OR Capacitor. Don't fight CORS, escalate to product owner if blocking.

## Testing

- If existing tests are present — run with existing runner, no new infra
- If no tests — DO NOT scaffold testing setup unless explicitly asked (the previous AI added 53 tests then half were deleted; don't repeat)
- Manual browser testing > unit tests for this UI-heavy app

## Planning mode

For any multi-file task: Planning mode (not Fast). Plan in `docs/plans/<n>.md`, get user approval, execute slice by slice, commit per slice.
