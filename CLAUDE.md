# CLAUDE.md

Rules for Claude Code and for every contributor working in this repository.

## Project

Snapia is an AI instant-photo app (a Smart Wash project). People take quick photos ("snaps"), save them in Spaces, and the AI turns them into study material, work reports or social content according to the Space mode.

**Read [docs/PRODUCT.md](docs/PRODUCT.md) before any task.** It contains the glossary and the product rules. Use the glossary names exactly as written.

Monorepo with npm workspaces:

- `apps/api`: Node 22, Express, TypeScript, Prisma, PostgreSQL, MinIO/S3, Claude API (vision)
- `apps/web`: React, Vite, TypeScript, Tailwind CSS, PWA
- `packages/shared`: Zod schemas and shared types

## Language

- Everything technical is in **English**: code, file names, variables, functions, comments, commit messages and technical documentation.
- User-facing text is in **Spanish** and lives only in `apps/web/src/i18n/locales/es.json`. Never write user-facing strings inside components; use translation keys.

## No hardcoded values

Never write URLs, ports, credentials, keys, the app name, AI model names, limits, thresholds or durations in code. They belong in:

- **Environment variables** validated with Zod in the `config` module (the only place that reads `process.env`).
- **The `AppSetting` table**, filled by the seed, for product rules.
- **Template files**, for example AI prompts.

Keep `.env.example` up to date with every variable.

## Architecture

- Layers: **routes → controller → service → repository**. Only repositories use Prisma.
- Validate every input (body, params, query) with Zod at the entry point.
- Errors: throw `AppError`; a central error middleware turns errors into responses.
- JSON responses: `{ data, meta }` on success, `{ error: { code, message, details } }` on failure.

## Authorization

Every route that touches a Space verifies the user's membership and role in that Space.

## Code quality

- TypeScript in `strict` mode, no `any`.
- ESLint and Prettier.
- Every new feature comes with tests: Vitest and Supertest. AI is tested with `MockAiProvider`.

## Git

- Conventional Commits in English (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`). Small, atomic commits.
- The author is the configured git identity. Never modify `git config user.*`.
- **Never** add `Co-Authored-By` trailers or "Generated with Claude Code" to commits or pull requests.
- Never use `--no-verify`.
- After cloning, run `git config core.hooksPath .githooks`: the `commit-msg` hook removes attribution lines.

## Definition of done

For each part: lint, typecheck and tests green, commits made, and `git push origin main`.

## Skills

Use the skills in `.claude/skills/` when they apply.
