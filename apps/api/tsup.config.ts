import { cpSync } from 'node:fs';
import { defineConfig } from 'tsup';

/** Files the AI module reads at runtime (see src/modules/ai/ai-files.ts). */
const AI_FOLDERS = ['prompts', 'fixtures'];

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // @snapia/shared ships TypeScript sources, so it is bundled instead of imported at runtime.
  noExternal: ['@snapia/shared'],
  // The bundle is dist/server.js, so the AI folders go to dist/ to keep the same relative paths.
  onSuccess: () => {
    for (const folder of AI_FOLDERS) {
      cpSync(`src/modules/ai/${folder}`, `dist/${folder}`, { recursive: true });
    }
    return Promise.resolve();
  },
});
