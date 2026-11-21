import { z } from 'zod';
import { EnvValidationError } from '../src/config/env';
import { loadConfig } from '../src/config/load-config';
import { hashPassword } from '../src/lib/password';
import { disconnectPrisma, getPrisma, type PrismaClient } from '../src/lib/prisma';
import {
  parseAppSettingsSeed,
  parseDemoDataSeed,
  readSeedFile,
  seedSettingValue,
  type AppSettingSeedEntry,
  type DemoData,
} from './seed-files';

/*
 * Idempotent seed (npm run db:seed): running it again never duplicates data and keeps what
 * admins changed. Every value comes from prisma/seed-data/*.json or from the SEED_* variables.
 */

interface UserSeedInput {
  name: string;
  username: string;
  email: string;
  password: string;
  role?: 'USER' | 'ADMIN';
  university?: string | undefined;
  bio?: string | undefined;
}

function log(message: string): void {
  process.stdout.write(`  ${message}\n`);
}

/** Creates the user unless one with the same username or email exists. */
async function ensureUser(
  prisma: PrismaClient,
  input: UserSeedInput,
  bcryptRounds: number,
): Promise<{ id: string; created: boolean }> {
  const username = input.username.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { id: true },
  });
  if (existing !== null) return { id: existing.id, created: false };

  const user = await prisma.user.create({
    data: {
      name: input.name,
      username,
      email,
      passwordHash: await hashPassword(input.password, bcryptRounds),
      role: input.role ?? 'USER',
      university: input.university ?? null,
      bio: input.bio ?? null,
    },
    select: { id: true },
  });
  return { id: user.id, created: true };
}

/** Creates the missing settings. Values that an admin changed are kept. Returns how many were created. */
async function seedAppSettings(
  prisma: PrismaClient,
  entries: readonly AppSettingSeedEntry[],
): Promise<number> {
  const existing = new Set(
    (await prisma.appSetting.findMany({ select: { key: true } })).map(({ key }) => key),
  );
  for (const entry of entries) {
    await prisma.appSetting.upsert({
      where: { key: entry.key },
      create: entry,
      // Only the description follows the file; the value stays as the admin left it.
      update: { description: entry.description },
    });
  }
  return entries.filter(({ key }) => !existing.has(key)).length;
}

function requireUserId(userIds: ReadonlyMap<string, string>, username: string): string {
  const id = userIds.get(username);
  if (id === undefined) throw new Error(`Unknown demo user ${username}`);
  return id;
}

/** Demo users and one Space per mode, with their memberships (no photos). */
async function seedDemoData(
  prisma: PrismaClient,
  demo: DemoData,
  bcryptRounds: number,
): Promise<{ usersCreated: number; spacesCreated: number }> {
  const userIds = new Map<string, string>();
  let usersCreated = 0;
  for (const user of demo.users) {
    const result = await ensureUser(prisma, user, bcryptRounds);
    userIds.set(user.username, result.id);
    if (result.created) usersCreated += 1;
  }

  let spacesCreated = 0;
  for (const space of demo.spaces) {
    const ownerId = requireUserId(userIds, space.owner);
    const existing = await prisma.space.findUnique({
      where: { id: space.id },
      select: { id: true },
    });
    await prisma.space.upsert({
      where: { id: space.id },
      create: {
        id: space.id,
        ownerId,
        name: space.name,
        description: space.description ?? null,
        mode: space.mode,
        color: space.color,
        visibility: space.visibility,
        metadata: space.metadata,
      },
      update: {},
    });
    if (existing === null) spacesCreated += 1;

    const members = [
      { userId: ownerId, role: 'OWNER' as const },
      ...space.members.map(({ username, role }) => ({
        userId: requireUserId(userIds, username),
        role,
      })),
    ];
    for (const member of members) {
      await prisma.spaceMember.upsert({
        where: { spaceId_userId: { spaceId: space.id, userId: member.userId } },
        create: { spaceId: space.id, ...member },
        update: {},
      });
    }
  }
  return { usersCreated, spacesCreated };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const prisma = getPrisma(config.database.url);
  process.stdout.write('Seeding the database…\n');

  try {
    const settings = parseAppSettingsSeed(readSeedFile('app-settings.json'));
    const settingsCreated = await seedAppSettings(prisma, settings);
    log(
      `AppSetting: ${settingsCreated} created, ${settings.length - settingsCreated} already present`,
    );

    const admin = await ensureUser(
      prisma,
      { ...config.seed.admin, role: 'ADMIN' },
      config.auth.bcryptRounds,
    );
    log(`ADMIN ${config.seed.admin.username}: ${admin.created ? 'created' : 'already present'}`);

    if (!config.seed.demoData) {
      log('Demo data: skipped (SEED_DEMO_DATA=false)');
    } else if (config.isProduction) {
      log('Demo data: skipped (it is never seeded in production)');
    } else {
      const palette = seedSettingValue(settings, 'space_color_palette');
      const demo = parseDemoDataSeed(readSeedFile('demo-data.json'), palette);
      const result = await seedDemoData(prisma, demo, config.auth.bcryptRounds);
      log(`Demo data: ${result.usersCreated} users and ${result.spacesCreated} Spaces created`);
    }
  } finally {
    await disconnectPrisma();
  }
  process.stdout.write('Seed finished.\n');
}

main().catch((error: unknown) => {
  if (error instanceof EnvValidationError) {
    process.stderr.write(`${error.message}\n`);
  } else if (error instanceof z.ZodError) {
    process.stderr.write(`Invalid seed data:\n${z.prettifyError(error)}\n`);
  } else {
    process.stderr.write(
      `Seed failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
  }
  process.exitCode = 1;
});
