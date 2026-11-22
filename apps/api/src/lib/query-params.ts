import { z } from 'zod';

/** A boolean in a query string: ?flag=true or ?flag=false. */
export const booleanQueryParam = z
  .enum(['true', 'false'], { error: 'expected true or false' })
  .transform((value) => value === 'true');
