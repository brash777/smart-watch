import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { z } from 'zod';

/** The monorepo root: the web app reads the same .env as the API (see .env.example). */
const envDir = fileURLToPath(new URL('../..', import.meta.url));

const buildEnvSchema = z.object({
  VITE_APP_NAME: z.string().trim().min(1),
  VITE_API_URL: z.string().trim().min(1),
  VITE_API_PROXY_TARGET: z.url(),
});

function readEnv(mode: string) {
  const parsed = buildEnvSchema.safeParse(loadEnv(mode, envDir, 'VITE_'));
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(
      `Invalid web environment (root .env, see .env.example):\n${problems.join('\n')}`,
    );
  }
  return parsed.data;
}

export default defineConfig(({ mode }) => {
  const env = readEnv(mode);
  // A relative VITE_API_URL (/api) goes through this proxy, so the browser never leaves the web
  // app's origin: it also works from a phone on the same network (vite --host).
  const proxy = env.VITE_API_URL.startsWith('/')
    ? { [env.VITE_API_URL]: { target: env.VITE_API_PROXY_TARGET, changeOrigin: true } }
    : undefined;

  return {
    envDir,
    plugins: [react(), tailwindcss()],
    server: { proxy },
    preview: { proxy },
  };
});
