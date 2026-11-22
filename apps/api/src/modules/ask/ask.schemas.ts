import { askBodySchema } from '@snapia/shared';
import type { RequestSchemas } from '../../middlewares/validate';

/** Request schemas of the ask routes. */
export const askInputs = {
  ask: { body: askBodySchema },
} satisfies Record<string, RequestSchemas>;
