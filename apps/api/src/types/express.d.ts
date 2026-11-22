import type { AuthContext } from '../middlewares/authenticate';
import type { SpaceAccess } from '../middlewares/require-space-role';

declare module 'express-serve-static-core' {
  interface Request {
    /** The signed-in user, set by authenticate and optionalAuth. */
    auth?: AuthContext;
    /** The caller's access to the Space of the URL, set by requireSpaceRole. */
    spaceAccess?: SpaceAccess;
  }
}
