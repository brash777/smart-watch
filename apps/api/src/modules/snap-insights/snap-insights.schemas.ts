import { z } from 'zod';
import type { RequestSchemas } from '../../middlewares/validate';

const snapParams = z.object({ id: z.uuid() });

/** Request schemas of the snap insight routes. */
export const snapInsightsInputs = {
  snap: { params: snapParams },
  // Any object here: the service checks it against the mode of the insight
  // (updateSnapInsightBodySchemas of @snapia/shared).
  update: { params: snapParams, body: z.record(z.string(), z.unknown()) },
} satisfies Record<string, RequestSchemas>;
