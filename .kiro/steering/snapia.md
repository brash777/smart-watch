---
inclusion: always
---

# Snapia

Before any task, read `docs/HANDOFF.md` (where the work stands and what is left), `CLAUDE.md` (engineering rules), `docs/PRODUCT.md` (glossary and product rules) and `docs/api.md` (endpoints). The skills in `.claude/skills/*/SKILL.md` describe how each kind of change is made; follow them as reference documents.

The rules that are easiest to break:

- Glossary names exactly as in PRODUCT.md; English code, comments, commits and docs; Spanish UI text only in `apps/web/src/i18n/locales/es.json` and `apps/wear/app/src/main/res/values/strings.xml`.
- No hardcoded URLs, ports, credentials, app name, model names, limits, thresholds or durations: `.env` (validated with Zod, documented in `.env.example`), `AppSetting` seed data, or prompt files.
- API: routes → controller → service → repository, Zod validation, `AppError`, `{ data, meta }`; Space routes check role. Shared schemas live in `packages/shared`.
- Web: one HTTP client (`src/lib/http.ts`), TanStack Query hooks, design tokens only, mode looks from `src/config/modes.ts`.
- Every change comes with tests; finish with `npm run lint`, `npm run typecheck`, `npm test` (needs `npm run db:up`), `npm run build`.
- Git: small Conventional Commits; never `Co-Authored-By` or "Generated with" lines, never `--no-verify`, never change `git config user.*`, never force-push.
- Decisions that belong to the user (real AI key and cost, exposing MinIO on the LAN, watch redesign, product scope): ask first.
- Never kill processes you did not start (another project may use port 5173).
