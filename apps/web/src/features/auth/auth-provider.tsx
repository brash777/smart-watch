import { useEffect, useState, type ReactNode } from 'react';
import { onSessionChange, refreshSession } from '../../lib/http';
import { AuthContext, type AuthState } from './auth-context';

/**
 * Follows the session of the HTTP client: it restores it from the refresh cookie when the app
 * starts, and ends it when a refresh fails.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    const unsubscribe = onSessionChange((session) => {
      setState(
        session === null
          ? { status: 'anonymous' }
          : { status: 'authenticated', user: session.user },
      );
    });
    void refreshSession();
    return unsubscribe;
  }, []);

  return <AuthContext value={state}>{children}</AuthContext>;
}
