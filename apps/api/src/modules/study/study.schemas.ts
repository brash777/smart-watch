import { generateStudyMaterialBodySchema, quizAttemptBodySchema } from '@snapia/shared';
import { z } from 'zod';
import type { RequestSchemas } from '../../middlewares/validate';

/** Request schemas of the study routes. */
export const studyInputs = {
  generate: { body: generateStudyMaterialBodySchema },
  attempt: { params: z.object({ id: z.uuid() }), body: quizAttemptBodySchema },
} satisfies Record<string, RequestSchemas>;
