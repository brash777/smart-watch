import { z } from 'zod';
import { EnvValidationError } from './env';
import { loadEnvFile } from './load-env-file';

const postgresUrlSchema = z.url({
  protocol: /^postgres(ql)?$/,
  error: 'expected a postgresql:// connection URL',
});

/** host:port/database of a connection URL, to tell whether two URLs reach the same database. */
function databaseIdentity(url: string): string | undefined {
  try {
    const { hostname, port, pathname } = new URL(url);
    return `${hostname}:${port}${pathname}`;
  } catch {
    return undefined;
  }
}

function invalid(problem: string): EnvValidationError {
  return new EnvValidationError([{ variable: 'TEST_DATABASE_URL', problem }]);
}

/**
 * TEST_DATABASE_URL for the integration tests, after loading the root .env file.
 * The tests delete every row of that database, so it must not be the DATABASE_URL database.
 */
export function readTestDatabaseUrl(): string {
  loadEnvFile();
  const value = process.env.TEST_DATABASE_URL?.trim();
  if (value === undefined || value === '') throw invalid('missing');

  const result = postgresUrlSchema.safeParse(value);
  if (!result.success) throw invalid(result.error.issues[0]?.message ?? 'invalid');

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl !== undefined && databaseIdentity(databaseUrl) === databaseIdentity(value)) {
    throw invalid('must point to another database than DATABASE_URL (the tests delete its data)');
  }
  return result.data;
}

/** Environment for a Prisma CLI process that must work on the given database. */
export function envWithDatabaseUrl(databaseUrl: string): NodeJS.ProcessEnv {
  return { ...process.env, DATABASE_URL: databaseUrl };
}
