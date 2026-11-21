import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'prisma/**/*.test.ts'],
    // Creates and migrates the TEST_DATABASE_URL database once (needs npm run db:up).
    globalSetup: ['test/global-setup.ts'],
    // Test files share that database, so they run one after another.
    fileParallelism: false,
  },
});
