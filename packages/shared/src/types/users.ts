import type { z } from 'zod';
import type {
  adminUserRoleBodySchema,
  adminUserSchema,
  adminUserStatusBodySchema,
  publicUserProfileSchema,
  updateMeBodySchema,
} from '../schemas/users';

export type UpdateMeBody = z.infer<typeof updateMeBodySchema>;
export type PublicUserProfile = z.infer<typeof publicUserProfileSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminUserStatusBody = z.infer<typeof adminUserStatusBodySchema>;
export type AdminUserRoleBody = z.infer<typeof adminUserRoleBodySchema>;
