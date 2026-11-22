import { ApiError } from '../lib/http';
import es from './locales/es.json';

type ErrorCode = keyof typeof es.errors;

function isKnownCode(code: string): code is ErrorCode {
  return Object.hasOwn(es.errors, code);
}

/** The i18n key of an error: errors.<CODE> for API errors, or the generic one. */
export function errorKey(error: unknown): `errors.${ErrorCode}` {
  const code = error instanceof ApiError ? error.code : 'UNKNOWN_ERROR';
  return isKnownCode(code) ? `errors.${code}` : 'errors.UNKNOWN_ERROR';
}
