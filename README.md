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

## After cloning

Enable the repository's git hooks. The `commit-msg` hook keeps commit messages free of attribution lines:

```bash
git config core.hooksPath .githooks
```

## Documentation

- [Product specification](docs/PRODUCT.md)
- [Project rules](CLAUDE.md)
