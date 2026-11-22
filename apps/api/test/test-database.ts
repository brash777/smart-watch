import { PrismaPg } from '@prisma/adapter-pg';
import { parseAppSettingsSeed, readSeedFile } from '../prisma/seed-files';
import { readTestDatabaseUrl } from '../src/config/test-database-url';
import { PrismaClient } from '../src/generated/prisma/client';

let prisma: PrismaClient | undefined;

/** Prisma client for TEST_DATABASE_URL, shared by the tests of one file. */
export function getTestPrisma(): PrismaClient {
  prisma ??= new PrismaClient({ adapter: new PrismaPg(readTestDatabaseUrl()) });
  return prisma;
}

/**
 * Empties every table except the migrations history, then loads the AppSetting values of
 * prisma/seed-data/app-settings.json, so each test starts from a clean, seeded database.
 */
export async function resetTestDatabase(): Promise<void> {
  const db = getTestPrisma();
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length > 0) {
    const tableList = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
    await db.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} CASCADE`);
  }
  await db.appSetting.createMany({ data: parseAppSettingsSeed(readSeedFile('app-settings.json')) });
}

export async function disconnectTestPrisma(): Promise<void> {
  const client = prisma;
  prisma = undefined;
  await client?.$disconnect();
}
