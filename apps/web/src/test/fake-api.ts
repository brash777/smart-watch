import { vi } from 'vitest';
import { env } from '../config/env';

export interface FakeCall {
  method: string;
  path: string;
  body: unknown;
}

type Answer = { status: number; body?: unknown };

/** Replaces fetch: answers "METHOD /path" (relative to VITE_API_URL) and records every call. */
export function fakeApi(answers: Record<string, Answer | Answer[]>) {
  const calls: FakeCall[] = [];
  const queues = new Map(
    Object.entries(answers).map(([route, answer]) => [
      route,
      Array.isArray(answer) ? [...answer] : [answer],
    ]),
  );
  const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
    const path = url.slice(env.apiUrl.length);
    calls.push({
      method,
      path,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    const queue = queues.get(`${method} ${path}`) ?? [];
    const answer = queue.length > 1 ? queue.shift() : queue[0];
    const { status, body } = answer ?? {
      status: 404,
      body: { error: { code: 'ROUTE_NOT_FOUND', message: 'Not found', details: null } },
    };
    return Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  vi.stubGlobal('fetch', fetch);
  return { calls };
}

export function apiError(code: string, status: number): Answer {
  return { status, body: { error: { code, message: code, details: null } } };
}
