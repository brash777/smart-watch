---
name: prisma-change
description: Change the database schema safely with Prisma (models, enums, migrations, seed data). Use when adding or modifying tables, columns, relations or seed data.
---

# Prisma changes

- Schema: `apps/api/prisma/schema.prisma`
- Migrations: `apps/api/prisma/migrations/`
- Seed: `apps/api/prisma/seed.ts`, which loads the data in `apps/api/prisma/seed-data/*.json`

## 1. Model conventions

- **Models:** PascalCase, singular, named after the glossary in `docs/PRODUCT.md` (`SpaceMember`, `SnapInsight`). Map them to snake_case plural tables with `@@map`.
- **Fields:** camelCase, mapped to snake_case columns with `@map` whenever the names differ (`spaceId` → `space_id`).
- **Ids:** UUIDs.
- **Timestamps:** every model has `createdAt` and `updatedAt`.
- **Enums:** PascalCase type, UPPER_SNAKE_CASE values taken from the glossary (`STUDY`, `WORK`, `CONTENT`).
- **Indexes:** on every field used to search, filter, join or sort (foreign keys, `createdAt` in feeds, hashtags, …).
- **Unique constraints** for real-world uniqueness: `username`, one membership per user and Space.
- **`onDelete` on purpose:** `Cascade` for children that make no sense alone (a SnapInsight without its Snap), `Restrict` or `SetNull` otherwise.

```prisma
enum SpaceRole {
  OWNER
  EDITOR
  VIEWER

  @@map("space_role")
}

model SpaceMember {
  id        String    @id @default(uuid()) @db.Uuid
  spaceId   String    @map("space_id") @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  role      SpaceRole
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  space Space @relation(fields: [spaceId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([spaceId, userId])
  @@index([userId])
  @@map("space_members")
}
```

## 2. Workflow

1. **Edit** `apps/api/prisma/schema.prisma`.
2. **Create and apply the migration:**

   ```bash
   npm run db:migrate -- --name <description>
   ```

   `<description>` is snake_case and says what changed: `add_space_invites`, `add_taken_at_to_snaps`.
3. **Review the generated SQL** in `apps/api/prisma/migrations/<timestamp>_<description>/migration.sql`:
   - A renamed field appears as `DROP COLUMN` + `ADD COLUMN`, which loses data. To fix the SQL before it runs, create the migration with `--create-only`, edit `migration.sql` (e.g. use `RENAME COLUMN`) and run `npm run db:migrate` again to apply it.
   - A new required column on a table that already has rows needs a default value or a backfill step.
4. **Update the seed** if the change needs data (see section 3).
5. **Regenerate the Prisma client:**

   ```bash
   npm run db:generate
   ```

6. **Update `packages/shared`:** the Zod schemas, enums and types that mirror the model, since the web app uses them. Enum values must stay identical to Prisma's.
7. **Tests:** add or update repository, service and API tests, then run the whole suite.
8. **Commit together** `schema.prisma`, the new migration folder and any seed changes (see the `git-commit` skill).

## 3. Seed rules

- **Idempotent:** running the seed twice gives the same result. Use `upsert` on a natural unique key (`AppSetting.key`, `User.username`).
- **No data in `seed.ts`:** it reads `prisma/seed-data/*.json`, validates each file with Zod and writes the result. Changing seed data means editing JSON, not code.
- **Admin changes survive:** for AppSetting, create the missing keys but do not overwrite existing values (`update: {}`), so values an admin changed are kept.
- **Initial admin from `.env`:** the first ADMIN's credentials come from environment variables, read through `config` and listed in `.env.example`. Hash the password and never log it.

```ts
// seed.ts (shape only)
const settings = appSettingSeedSchema.parse(readSeedFile('app-settings.json'));

for (const setting of settings) {
  await prisma.appSetting.upsert({
    where: { key: setting.key },
    create: setting,
    update: {},
  });
}
```

## 4. Migration rules

- **Never edit a migration that is already committed.** To fix or undo it, create a new migration.
- A migration that only exists on your machine and is not committed can still be changed: delete its folder, reset your local database if needed and generate it again.
- Always commit the `migrations/` folder, including `migration_lock.toml`.
- Do not use `prisma db push` for real schema changes: it skips migrations.
- Resetting the database (`prisma migrate reset`) deletes all data. Only do it on your local development database, and ask first if the data matters.

## 5. Checklist

- [ ] Models and fields follow the conventions: `@@map`, `@map`, UUID ids, `createdAt`/`updatedAt`, indexes, unique constraints.
- [ ] Migration created with `npm run db:migrate -- --name <description>` and its SQL reviewed.
- [ ] No committed migration edited.
- [ ] Seed idempotent, data in JSON, admin credentials from `.env`.
- [ ] `npm run db:generate` run and `packages/shared` updated.
- [ ] Tests pass; schema, migration and seed committed together.
