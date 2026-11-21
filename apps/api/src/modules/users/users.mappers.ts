import type { AdminUser, UserRole, UserSummary } from '@snapia/shared';

interface UserSummaryRecord {
  id: string;
  name: string;
  username: string;
  avatarKey: string | null;
}

/** A user as shown in lists. Profile photos arrive with file storage: until then there is no URL. */
export function toUserSummary(user: UserSummaryRecord): UserSummary {
  return { id: user.id, name: user.name, username: user.username, avatarUrl: null };
}

export function toAdminUser(
  user: UserSummaryRecord & { email: string; role: UserRole; isActive: boolean; createdAt: Date },
): AdminUser {
  return {
    ...toUserSummary(user),
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}
