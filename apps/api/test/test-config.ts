import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv as parseDotenv } from 'node:util';
import { parseEnv, type Config } from '../src/config/env';
import { findWorkspaceRoot } from '../src/config/load-env-file';

/** Values of the root .env.example, so tests never depend on a developer's .env. */
export function readEnvExample(): Record<string, string | undefined> {
  const root = findWorkspaceRoot(process.cwd());
  if (root === undefined) throw new Error('Could not find the workspace root');
  return parseDotenv(readFileSync(join(root, '.env.example'), 'utf8'));
}

/** A valid Config from .env.example with NODE_ENV=test and silent logs, plus overrides. */
export function createTestConfig(overrides: Record<string, string | undefined> = {}): Config {
  return parseEnv({ ...readEnvExample(), NODE_ENV: 'test', LOG_LEVEL: 'silent', ...overrides });
}
