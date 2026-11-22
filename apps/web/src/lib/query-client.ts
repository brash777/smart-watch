import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './http';

/** Retries of a failed read: the same number TanStack Query uses by default. */
const QUERY_RETRIES = 3;

/** Errors that a retry cannot fix: the request itself is wrong or not allowed. */
function isClientError(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => !isClientError(error) && failureCount < QUERY_RETRIES,
      },
      mutations: { retry: false },
    },
  });
}
