import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

export type { PrismaClient } from '../generated/prisma/client';

let prisma: PrismaClient | undefined;

/** The single PrismaClient of the process, created on first use with the given database URL. */
export function getPrisma(databaseUrl: string): PrismaClient {
  prisma ??= new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
  return prisma;
}

/** Closes the database connections. The next getPrisma() call creates a new client. */
export async function disconnectPrisma(): Promise<void> {
  const client = prisma;
  prisma = undefined;
  await client?.$disconnect();
}
