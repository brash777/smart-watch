import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { envWithDatabaseUrl, readTestDatabaseUrl } from '../src/config/test-database-url';

const apiDirectory = fileURLToPath(new URL('..', import.meta.url));
const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');

/**
 * Runs once before the test files: creates the test database when it does not exist and
 * applies the migrations (prisma migrate deploy). PostgreSQL must be running (npm run db:up).
 */
export default function setup(): void {
  const testDatabaseUrl = readTestDatabaseUrl();
  const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: apiDirectory,
    env: envWithDatabaseUrl(testDatabaseUrl),
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const { hostname, port, pathname } = new URL(testDatabaseUrl);
    throw new Error(
      `Could not prepare the test database ${hostname}:${port}${pathname}. ` +
        `Is PostgreSQL running? Start it with: npm run db:up\n\n${result.stderr.trim()}`,
    );
  }
}
