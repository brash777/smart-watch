import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ENV_FILE_NAME = '.env';

/** Returns the monorepo root: the closest directory, from startDir upwards, whose package.json declares workspaces. */
export function findWorkspaceRoot(startDir: string): string | undefined {
  let dir = startDir;
  for (;;) {
    const packageJsonPath = join(dir, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        workspaces?: unknown;
      };
      if (packageJson.workspaces !== undefined) return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Loads the root .env file into process.env when it exists (local development).
 * Variables already set in the real environment win over the file, so a deployment
 * can configure the API with environment variables only. Returns the loaded path.
 */
export function loadEnvFile(startDir: string = process.cwd()): string | undefined {
  const root = findWorkspaceRoot(startDir);
  if (root === undefined) return undefined;
  const envPath = join(root, ENV_FILE_NAME);
  if (!existsSync(envPath)) return undefined;
  process.loadEnvFile(envPath);
  return envPath;
}
