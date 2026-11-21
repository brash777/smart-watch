import { z } from 'zod';

const errorResponseSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown() }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>['error'];

/** Checks that a response body has the API error shape and returns its `error` object. */
export function readError(body: unknown): ErrorResponse {
  return errorResponseSchema.parse(body).error;
}
