import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** Tests read the VITE_* values of .env.example, never a developer's .env. */
const example = parseEnv(readFileSync(new URL('../../.env.example', import.meta.url), 'utf8'));
const viteEnv = Object.fromEntries(
  Object.entries(example).filter(([name]) => name.startsWith('VITE_')),
);

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    env: viteEnv,
  },
});
