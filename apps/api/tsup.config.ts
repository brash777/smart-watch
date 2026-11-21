import { defineConfig } from 'tsup';

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
});
