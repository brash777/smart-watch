# Snapia

**A Smart Wash project.**

Snapia is an AI instant-photo app: take quick photos ("snaps") and save them in Spaces.
Each Space has a mode (STUDY, WORK or CONTENT), and the AI turns its snaps into useful work:
class notes and study material, work reports with photo evidence, or captions, posts and a portfolio.

## Stack

- Monorepo with npm workspaces
- `apps/api`: Node 22, Express, TypeScript, Prisma, PostgreSQL, MinIO/S3, Claude API (vision)
- `apps/web`: React, Vite, TypeScript, Tailwind CSS, PWA
- `packages/shared`: Zod schemas and shared types

## Status

In progress.

## Getting started

Requirements: Node.js 22 (`nvm use`), npm and Docker.

```bash
cp .env.example .env   # local configuration; never commit .env
npm install            # installs every workspace and enables the git hooks
npm run db:up          # starts PostgreSQL and MinIO and waits until they are healthy
npm run dev            # runs the API in watch mode
```

Then open `GET /api/health` on the API (`API_BASE_URL` in `.env`).

`npm install` runs `git config core.hooksPath .githooks`. The `commit-msg` hook keeps commit messages free of attribution lines.

| Script                                                         | What it does                                        |
| -------------------------------------------------------------- | --------------------------------------------------- |
| `npm run dev`                                                  | Every `dev:*` script in parallel (for now, the API) |
| `npm run build`                                                | Builds every workspace that has a build             |
| `npm run lint` / `npm run typecheck` / `npm test`              | ESLint, TypeScript and Vitest checks                |
| `npm run format`                                               | Formats the repository with Prettier                |
| `npm run db:up` / `npm run db:down`                            | Starts or stops the Docker services                 |
| `npm run db:migrate` / `db:generate` / `db:seed` / `db:studio` | Prisma commands for the API database                |

## Documentation

- [Product specification](docs/PRODUCT.md)
- [Project rules](CLAUDE.md)

## Claude Code skills

Project skills live in `.claude/skills/`. Claude Code loads them automatically; type `/skills` to list them.

| Skill                | What it is for                                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `snapia-conventions` | Folder structure, naming, glossary, English code, Spanish UI through i18n and where each value lives. Use before creating or editing any file.             |
| `git-commit`         | Checks, Conventional Commits, no attribution lines, verification and push. Use before committing, pushing or opening a pull request.                       |
| `api-module`         | Backend feature modules: routes, controller, service, repository, Zod schemas, Space authorization and tests. Use when adding or changing an API endpoint. |
| `ai-vision-task`     | AI tasks: the AiProvider interface, versioned prompts, JSON output validated with Zod, privacy rules and AiRun logging. Use for any prompt or LLM call.    |
| `prisma-change`      | Database changes: model conventions, migrations and idempotent seed data. Use when changing tables, columns, relations or seed data.                       |
| `react-feature`      | Screens and components: TanStack Query, i18n, design tokens, mobile-first Instagram-like UX and accessibility. Use when creating or changing UI.           |
