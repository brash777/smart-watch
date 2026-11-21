import type { RequestHandler, Response } from 'express';
import { z } from 'zod';

/** Zod schemas for the parts of a request an endpoint accepts. */
export interface RequestSchemas {
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
}

/** The parsed request parts, typed by their schemas. */
export type ValidatedInput<S extends RequestSchemas> = {
  [K in keyof S]: S[K] extends z.ZodType ? z.output<S[K]> : never;
};

const INPUT_KEY = 'validatedInput';

/**
 * Parses params, query and body with the given schemas. Invalid input throws a ZodError,
 * which the error middleware answers with 400 VALIDATION_ERROR (paths such as body.email).
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  const schema = z.object(schemas as Record<string, z.ZodType>);
  return (req, res, next) => {
    const body: unknown = req.body;
    res.locals[INPUT_KEY] = schema.parse({ params: req.params, query: req.query, body });
    next();
  };
}

/**
 * The input validated by validate(), typed by the same schemas object.
 * Controllers and services only use these values, never the raw request.
 */
export function getValidatedInput<S extends RequestSchemas>(
  res: Response,
  _schemas: S,
): ValidatedInput<S> {
  const input: unknown = res.locals[INPUT_KEY];
  if (input === undefined) throw new Error('validate() must run before getValidatedInput()');
  return input as ValidatedInput<S>;
}
