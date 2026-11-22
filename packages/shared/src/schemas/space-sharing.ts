import { z } from 'zod';
import { userSummarySchema } from './auth';
import { spaceRoleSchema } from './enums';
import { spaceSchema } from './spaces';

/** A member of a Space (GET /api/spaces/:spaceId/members). */
export const spaceMemberSchema = z.object({
  user: userSummarySchema,
  role: spaceRoleSchema,
  joinedAt: z.iso.datetime(),
});

/** PATCH /api/spaces/:spaceId/members/:userId */
export const updateMemberRoleBodySchema = z.object({ role: spaceRoleSchema });

/** Roles an invite can grant: OWNER is never given through a code. */
export const inviteRoleSchema = spaceRoleSchema.exclude(['OWNER']);

/**
 * POST /api/spaces/:spaceId/invites. Without expiresInHours or maxUses, the
 * invite_default_ttl_hours and invite_default_max_uses settings apply.
 */
export const createInviteBodySchema = z.object({
  role: inviteRoleSchema,
  expiresInHours: z.number().int().positive().optional(),
  maxUses: z.number().int().positive().optional(),
});

export const inviteStatusSchema = z.enum(['ACTIVE', 'EXPIRED', 'REVOKED', 'USED_UP']);

/** A SpaceInvite as its OWNERs see it. */
export const spaceInviteSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  role: inviteRoleSchema,
  expiresAt: z.iso.datetime(),
  maxUses: z.number().int().positive(),
  uses: z.number().int().nonnegative(),
  revokedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  status: inviteStatusSchema,
});

/** POST /api/spaces/join. Case, spaces and dashes in the code do not matter. */
export const joinSpaceBodySchema = z.object({
  code: z
    .string()
    .transform((code) => code.replace(/[\s-]/g, '').toUpperCase())
    .pipe(z.string().min(1, 'is required')),
});

/** Answer of POST /api/spaces/join. */
export const joinSpaceResultSchema = z.object({
  space: spaceSchema,
  role: spaceRoleSchema,
  /** True when you were already a member: nothing changed and no use was spent. */
  alreadyMember: z.boolean(),
});
