import type { z } from 'zod';
import type { appConfigSchema } from '../schemas/app-config';

export type AppConfig = z.infer<typeof appConfigSchema>;
