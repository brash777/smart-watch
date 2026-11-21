import { defineConfig } from 'prisma/config';
import { readDatabaseUrl } from './src/config/load-config';

// The Prisma CLI does not read .env files: readDatabaseUrl() loads the monorepo root .env first.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: readDatabaseUrl(),
  },
});
