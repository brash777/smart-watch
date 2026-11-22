import type { z } from 'zod';
import type {
  createInviteBodySchema,
  inviteStatusSchema,
  joinSpaceBodySchema,
  joinSpaceResultSchema,
  spaceInviteSchema,
  spaceMemberSchema,
  updateMemberRoleBodySchema,
} from '../schemas/space-sharing';

export type SpaceMember = z.infer<typeof spaceMemberSchema>;
export type UpdateMemberRoleBody = z.infer<typeof updateMemberRoleBodySchema>;
export type CreateInviteBody = z.infer<typeof createInviteBodySchema>;
export type InviteStatus = z.infer<typeof inviteStatusSchema>;
export type SpaceInvite = z.infer<typeof spaceInviteSchema>;
export type JoinSpaceBody = z.infer<typeof joinSpaceBodySchema>;
export type JoinSpaceResult = z.infer<typeof joinSpaceResultSchema>;
