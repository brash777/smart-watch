import {
  authSessionSchema,
  type AuthSession,
  type LoginBody,
  type RegisterBody,
} from '@snapia/shared';
import { apiRequest, apiSend, setSession } from '../../lib/http';

/*
 * Sign-in requests. They never trigger the automatic refresh: a 401 here means wrong
 * credentials, not an expired session.
 */

export async function login(body: LoginBody): Promise<AuthSession> {
  const { data } = await apiRequest('/auth/login', authSessionSchema, {
    method: 'POST',
    body,
    refreshOnUnauthorized: false,
  });
  setSession(data);
  return data;
}

export async function register(body: RegisterBody): Promise<AuthSession> {
  const { data } = await apiRequest('/auth/register', authSessionSchema, {
    method: 'POST',
    body,
    refreshOnUnauthorized: false,
  });
  setSession(data);
  return data;
}

/** Ends the session here even if the API cannot be reached. */
export async function logout(): Promise<void> {
  try {
    await apiSend('/auth/logout', { method: 'POST', refreshOnUnauthorized: false });
  } finally {
    setSession(null);
  }
}
