/**
 * Expected failure of a request. The error middleware turns it into
 * `{ error: { code, message, details } }` with the given HTTP status.
 *
 * - `code`: stable UPPER_SNAKE_CASE identifier; the web app maps it to Spanish text.
 * - `message`: English, for developers.
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(code: string, message: string, status: number, details: unknown = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
