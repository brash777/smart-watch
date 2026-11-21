import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/app-error';

interface ErrorResponseBody {
  error: { code: string; message: string; details: unknown };
}

function errorBody(code: string, message: string, details: unknown = null): ErrorResponseBody {
  return { error: { code, message, details } };
}

/** Errors raised by the JSON body parser carry a type, an HTTP status and a safe message. */
interface BodyParserError {
  type: string;
  status: number;
  message: string;
}

function isBodyParserError(error: unknown): error is BodyParserError {
  return (
    error instanceof Error &&
    'type' in error &&
    typeof error.type === 'string' &&
    'status' in error &&
    typeof error.status === 'number' &&
    'expose' in error &&
    error.expose === true
  );
}

const BODY_PARSER_ERROR_CODES: Readonly<Record<string, string>> = {
  'entity.parse.failed': 'INVALID_JSON',
  'entity.too.large': 'PAYLOAD_TOO_LARGE',
};

function describeError(error: unknown): unknown {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { value: String(error) };
}

export interface ErrorHandlerOptions {
  /** In production, unexpected errors never expose their details. */
  isProduction: boolean;
}

/**
 * Central error middleware:
 * - ZodError → 400 VALIDATION_ERROR with the list of issues;
 * - AppError → its own status, code, message and details;
 * - JSON body errors → 400 INVALID_JSON or 413 PAYLOAD_TOO_LARGE;
 * - anything else → 500 INTERNAL_ERROR (details only outside production).
 */
export function createErrorHandler({ isProduction }: ErrorHandlerOptions): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof ZodError) {
      const issues = error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
        code: issue.code,
      }));
      res.status(400).json(errorBody('VALIDATION_ERROR', 'Invalid request', issues));
      return;
    }

    if (error instanceof AppError) {
      if (error.status >= 500) req.log.error({ err: error }, error.message);
      res.status(error.status).json(errorBody(error.code, error.message, error.details));
      return;
    }

    if (isBodyParserError(error)) {
      const code = BODY_PARSER_ERROR_CODES[error.type] ?? 'BAD_REQUEST';
      res.status(error.status).json(errorBody(code, error.message));
      return;
    }

    req.log.error({ err: error }, 'Unhandled error');
    res
      .status(500)
      .json(
        errorBody(
          'INTERNAL_ERROR',
          'Internal server error',
          isProduction ? null : describeError(error),
        ),
      );
  };
}
