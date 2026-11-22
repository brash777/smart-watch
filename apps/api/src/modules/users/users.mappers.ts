import type { AdminUser, UserRole, UserSummary } from '@snapia/shared';
import type { AvatarUrlResolver } from './avatars';

export interface UserSummaryRecord {
  id: string;
  name: string;
  username: string;
  avatarKey: string | null;
}

/** A user as shown in lists, with a signed URL of their square profile photo (or null). */
export async function toUserSummary(
  user: UserSummaryRecord,
  avatarUrl: AvatarUrlResolver,
): Promise<UserSummary> {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatarUrl: await avatarUrl(user.avatarKey),
  };
}

export async function toAdminUser(
  user: UserSummaryRecord & { email: string; role: UserRole; isActive: boolean; createdAt: Date },
  avatarUrl: AvatarUrlResolver,
): Promise<AdminUser> {
  return {
    ...(await toUserSummary(user, avatarUrl)),
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}
