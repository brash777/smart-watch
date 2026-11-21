import {
  adminUserRoleBodySchema,
  adminUserStatusBodySchema,
  updateMeBodySchema,
  userRoleSchema,
} from '@snapia/shared';
import { z } from 'zod';
import type { Config } from '../../config/env';
import { createPaginationQuerySchema } from '../../lib/pagination';
import type { RequestSchemas } from '../../middlewares/validate';

/** A username in a URL. Unknown or malformed usernames simply do not exist (404). */
export const usernameParamsSchema = z.object({
  username: z.string().trim().toLowerCase().min(1),
});

const optionalText = z.string().trim().min(1).optional();
const booleanQuery = z
  .enum(['true', 'false'], { error: 'expected true or false' })
  .transform((value) => value === 'true');

/** Request schemas of the users routes (the page size limits come from the config). */
export function createUsersInputs(pagination: Config['pagination']) {
  const pageQuery = createPaginationQuerySchema(pagination);
  const userIdParams = z.object({ id: z.uuid() });

  return {
    profile: { params: usernameParamsSchema },
    updateMe: { body: updateMeBodySchema },
    search: { query: pageQuery.extend({ q: z.string().trim().min(1, 'is required') }) },
    adminList: {
      query: pageQuery.extend({
        q: optionalText,
        role: userRoleSchema.optional(),
        isActive: booleanQuery.optional(),
      }),
    },
    adminStatus: { params: userIdParams, body: adminUserStatusBodySchema },
    adminRole: { params: userIdParams, body: adminUserRoleBodySchema },
  } satisfies Record<string, RequestSchemas>;
}

export type UsersInputs = ReturnType<typeof createUsersInputs>;
