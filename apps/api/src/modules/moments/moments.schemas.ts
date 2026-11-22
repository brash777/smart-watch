import { createMomentBodySchema } from '@snapia/shared';
import { z } from 'zod';
import type { RequestSchemas } from '../../middlewares/validate';

/** Request schemas of the moments routes. */
export const momentsInputs = {
  create: { body: createMomentBodySchema },
  moment: { params: z.object({ id: z.uuid() }) },
} satisfies Record<string, RequestSchemas>;
