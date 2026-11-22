import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { z } from 'zod';
import es from './src/i18n/locales/es.json';

/** The monorepo root: the web app reads the same .env as the API (see .env.example). */
const envDir = fileURLToPath(new URL('../..', import.meta.url));

/** The --canvas tokens of src/styles/tokens.css, for the installed app's splash and bars. */
const PWA_COLORS = { light: '#f5f6f8', dark: '#0f1115' } as const;

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          name: env.VITE_APP_NAME,
          short_name: env.VITE_APP_NAME,
          description: es.app.description,
          lang: 'es',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: PWA_COLORS.light,
          theme_color: PWA_COLORS.light,
          icons: [
            { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icons/maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // The API is never cached or answered with the app shell: its answers depend on the session.
          navigateFallbackDenylist: env.VITE_API_URL.startsWith('/')
            ? [new RegExp(`^${escapeForRegExp(env.VITE_API_URL)}`)]
            : [],
        },
      }),
    ],
    server: { proxy },
    preview: { proxy },
  };
});
