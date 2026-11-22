import { z } from 'zod';
import type { RequestSchemas } from '../../middlewares/validate';

/** Request schemas of the likes routes. */
export const likesInputs = {
  toggle: { params: z.object({ id: z.uuid() }) },
} satisfies Record<string, RequestSchemas>;
