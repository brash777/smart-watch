import type { AuthContext } from '../middlewares/authenticate';

declare module 'express-serve-static-core' {
  interface Request {
    /** The signed-in user, set by authenticate and optionalAuth. */
    auth?: AuthContext;
  }
}
