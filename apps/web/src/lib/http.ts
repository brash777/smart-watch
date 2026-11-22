import { authSessionSchema, type AuthSession } from '@snapia/shared';
import { z } from 'zod';
import { env } from '../config/env';

/*
 * The one HTTP client of the web app. It sends the access token, which lives only in memory, and
 * the refresh cookie (httpOnly). When the API answers 401, it refreshes the session once and
 * repeats the request once; if the refresh fails, the session ends.
 */

/** An API failure: the code of { error: { code } }, or NETWORK_ERROR when the API is out of reach. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** False for the requests that must not start a refresh (login, register, refresh, logout). */
  refreshOnUnauthorized?: boolean;
}

export type SessionListener = (session: AuthSession | null) => void;

const errorBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});
const sessionEnvelopeSchema = z.object({ data: authSessionSchema });

let accessToken: string | null = null;
const sessionListeners = new Set<SessionListener>();
let refreshInFlight: Promise<AuthSession | null> | null = null;

/** Starts or ends the session in memory and tells the listeners (the auth provider). */
export function setSession(session: AuthSession | null): void {
  accessToken = session?.accessToken ?? null;
  for (const listener of sessionListeners) listener(session);
}

export function onSessionChange(listener: SessionListener): () => void {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

async function send(
  path: string,
  { method = 'GET', body, signal }: RequestOptions,
): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken !== null) headers.Authorization = `Bearer ${accessToken}`;
  try {
    return await fetch(`${env.apiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      signal,
    });
  } catch (error) {
    if (signal?.aborted === true) throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'The API could not be reached');
  }
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function toApiError(response: Response, body: unknown): ApiError {
  const parsed = errorBodySchema.safeParse(body);
  if (!parsed.success) {
    return new ApiError(response.status, 'UNKNOWN_ERROR', `HTTP ${String(response.status)}`);
  }
  const { code, message, details } = parsed.data.error;
  return new ApiError(response.status, code, message, details ?? null);
}

/**
 * Asks for a new access token with the refresh cookie. Simultaneous calls share one request,
 * because the API rotates the refresh token. Null when there is no valid session.
 */
export function refreshSession(): Promise<AuthSession | null> {
  refreshInFlight ??= (async () => {
    try {
      const response = await send('/auth/refresh', { method: 'POST' });
      const parsed = response.ok ? sessionEnvelopeSchema.safeParse(await readBody(response)) : null;
      const session = parsed?.success === true ? parsed.data.data : null;
      setSession(session);
      return session;
    } catch {
      setSession(null);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** The response, after one refresh and one retry when the API answers 401. */
async function sendWithRefresh(path: string, options: RequestOptions): Promise<Response> {
  const response = await send(path, options);
  if (response.status !== 401 || options.refreshOnUnauthorized === false) return response;
  const session = await refreshSession();
  return session === null ? response : send(path, options);
}

/** A JSON request: { data, meta } on success, an ApiError otherwise. data is checked with schema. */
export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<{ data: T; meta: unknown }> {
  const response = await sendWithRefresh(path, options);
  const body = await readBody(response);
  if (!response.ok) throw toApiError(response, body);
  const envelope = z.object({ data: schema, meta: z.unknown().optional() }).parse(body);
  return { data: envelope.data, meta: envelope.meta };
}

/** A request whose answer has no body (204). */
export async function apiSend(path: string, options: RequestOptions = {}): Promise<void> {
  const response = await sendWithRefresh(path, options);
  if (!response.ok) throw toApiError(response, await readBody(response));
}
