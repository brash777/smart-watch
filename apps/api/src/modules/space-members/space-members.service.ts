import type { SpaceMember, SpaceRole } from '@snapia/shared';
import { AppError } from '../../lib/app-error';
import { mapPage, toPage, type Page } from '../../lib/pagination';
import type { SpaceAccess } from '../../middlewares/require-space-role';
import type { AvatarUrlResolver } from '../users/avatars';
import { toUserSummary } from '../users/users.mappers';
import type { UserPageQuery } from '../users/users.repository';
import type {
  MemberRecord,
  MembershipQueries,
  SpaceMembersRepository,
} from './space-members.repository';

async function toSpaceMember(
  member: MemberRecord,
  avatarUrl: AvatarUrlResolver,
): Promise<SpaceMember> {
  return {
    user: await toUserSummary(member.user, avatarUrl),
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
  };
}

const memberNotFound = () => new AppError('MEMBER_NOT_FOUND', 'This user is not a member', 404);

export interface SpaceMembersServiceDependencies {
  repository: SpaceMembersRepository;
  avatarUrl: AvatarUrlResolver;
}

export function createSpaceMembersService({
  repository,
  avatarUrl,
}: SpaceMembersServiceDependencies) {
  async function findMember(queries: MembershipQueries, spaceId: string, userId: string) {
    const member = await queries.findMember(spaceId, userId);
    if (member === null) throw memberNotFound();
    return member;
  }

  /** A Space always keeps at least one OWNER. */
  async function assertNotLastOwner(
    queries: MembershipQueries,
    spaceId: string,
    member: MemberRecord,
  ): Promise<void> {
    if (member.role === 'OWNER' && (await queries.countOwners(spaceId)) <= 1) {
      throw new AppError('LAST_OWNER', 'The last OWNER cannot leave or stop being an OWNER', 409);
    }
  }

  /** When the user recorded as the Space's owner stops being an OWNER, another OWNER takes over. */
  async function handOverOwnership(
    queries: MembershipQueries,
    spaceId: string,
    userId: string,
  ): Promise<void> {
    const space = await queries.findSpace(spaceId);
    if (space?.ownerId !== userId) return;
    const nextOwner = await queries.findOldestOtherOwner(spaceId, userId);
    if (nextOwner !== null) await queries.setSpaceOwner(spaceId, nextOwner.userId);
  }

  async function removeMember(spaceId: string, userId: string): Promise<void> {
    await repository.withSpaceLock(spaceId, async (queries) => {
      const member = await findMember(queries, spaceId, userId);
      await assertNotLastOwner(queries, spaceId, member);
      await handOverOwnership(queries, spaceId, userId);
      await queries.removeMember(spaceId, userId);
    });
  }

  return {
    async list(access: SpaceAccess, page: UserPageQuery): Promise<Page<SpaceMember>> {
      const rows = await repository.list(access.spaceId, page);
      return mapPage(
        toPage(rows, page.limit, ({ id }) => id),
        (member) => toSpaceMember(member, avatarUrl),
      );
    },

    /** OWNERs change roles. A PRIVATE Space only has OWNERs, so it cannot get other roles. */
    async changeRole(access: SpaceAccess, userId: string, role: SpaceRole): Promise<SpaceMember> {
      return repository.withSpaceLock(access.spaceId, async (queries) => {
        const member = await findMember(queries, access.spaceId, userId);
        if (member.role === role) return toSpaceMember(member, avatarUrl);
        if (role !== 'OWNER') {
          if (access.visibility === 'PRIVATE') {
            throw new AppError(
              'SPACE_IS_PRIVATE',
              'A PRIVATE Space only has OWNERs: share it (MEMBERS or PUBLIC) first',
              409,
            );
          }
          await assertNotLastOwner(queries, access.spaceId, member);
          await handOverOwnership(queries, access.spaceId, userId);
        }
        return toSpaceMember(await queries.setRole(access.spaceId, userId, role), avatarUrl);
      });
    },

    /** OWNERs remove members (their snaps stay in the Space). */
    remove(access: SpaceAccess, userId: string): Promise<void> {
      return removeMember(access.spaceId, userId);
    },

    /** Any member may leave, except the last OWNER. */
    async leave(access: SpaceAccess, userId: string): Promise<void> {
      if (access.memberRole === null) {
        throw new AppError('NOT_A_MEMBER', 'You are not a member of this Space', 409);
      }
      await removeMember(access.spaceId, userId);
    },
  };
}

export type SpaceMembersService = ReturnType<typeof createSpaceMembersService>;
