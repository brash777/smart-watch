import { parseEnv, type Config } from './env';
import { loadEnvFile } from './load-env-file';

/**
 * Reads the root .env file (when it exists) and the real environment, and returns the
 * validated configuration. Throws EnvValidationError listing every invalid variable.
 * This is the only place of the API that reads process.env.
 */
export function loadConfig(): Config {
  loadEnvFile();
  return parseEnv(process.env);
}
