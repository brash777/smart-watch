import { parseEnv, type Config } from './env';
import { loadEnvFile } from './load-env-file';

/*
 * The config module is the only place of the API that reads process.env.
 */

/**
 * Reads the root .env file (when it exists) and the real environment, and returns the
 * validated configuration. Throws EnvValidationError listing every invalid variable.
 */
export function loadConfig(): Config {
  loadEnvFile();
  return parseEnv(process.env);
}

/**
 * DATABASE_URL for the Prisma CLI (prisma7.config.ts), after loading the root .env file.
 * It may be undefined: `prisma generate` does not need it, migrate and studio report it.
 */
export function readDatabaseUrl(): string | undefined {
  loadEnvFile();
  return process.env.DATABASE_URL;
}
