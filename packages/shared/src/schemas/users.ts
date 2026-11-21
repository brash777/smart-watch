import { z } from 'zod';
import { personNameSchema, userSummarySchema } from './auth';
import { userRoleSchema } from './enums';

/** Free text that can be cleared: an empty string becomes null. */
const clearableText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable();

/** PATCH /api/users/me: change the name, the bio or the university (at least one). */
export const updateMeBodySchema = z
  .object({
    name: personNameSchema.optional(),
    bio: clearableText.optional(),
    university: clearableText.optional(),
  })
  .refine(
    (body) => Object.values(body).some((value) => value !== undefined),
    'send at least one of name, bio or university',
  );

/** Public profile (GET /api/users/:username). It never includes the email or the role. */
export const publicUserProfileSchema = userSummarySchema.extend({
  bio: z.string().nullable(),
  counts: z.object({
    posts: z.number().int().nonnegative(),
    followers: z.number().int().nonnegative(),
    following: z.number().int().nonnegative(),
  }),
  /** False for anonymous visitors and on your own profile. */
  isFollowedByMe: z.boolean(),
});

/** A user as ADMINs see it in the admin panel. */
export const adminUserSchema = userSummarySchema.extend({
  email: z.string(),
  role: userRoleSchema,
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
});

/** PATCH /api/admin/users/:id/status */
export const adminUserStatusBodySchema = z.object({ isActive: z.boolean() });

/** PATCH /api/admin/users/:id/role */
export const adminUserRoleBodySchema = z.object({ role: userRoleSchema });
