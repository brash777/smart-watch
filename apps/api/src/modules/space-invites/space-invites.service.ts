import { randomInt } from 'node:crypto';
import {
  inviteRoleSchema,
  type CreateInviteBody,
  type InviteStatus,
  type JoinSpaceResult,
  type SpaceInvite,
} from '@snapia/shared';
import { AppError } from '../../lib/app-error';
import { isUniqueConstraintError } from '../../lib/prisma';
import type { SpaceAccess } from '../../middlewares/require-space-role';
import type { SettingsService } from '../settings/settings.service';
import { toSpace } from '../spaces/spaces.mappers';
import type { SpacesRepository } from '../spaces/spaces.repository';
import type { InviteRecord, SpaceInvitesRepository } from './space-invites.repository';

/** Invite code characters: no I, L, O, 0 or 1, which are easy to confuse. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** A new code is drawn when one collides with an existing invite (very unlikely). */
const CODE_GENERATION_ATTEMPTS = 3;
const MILLISECONDS_PER_HOUR = 3_600_000;

/** A random code of `length` characters from a cryptographically secure source. */
export function generateInviteCode(length: number): string {
  let code = '';
  for (let index = 0; index < length; index += 1) {
    code += CODE_ALPHABET.charAt(randomInt(CODE_ALPHABET.length));
  }
  return code;
}

export function inviteStatus(invite: InviteRecord, now: Date): InviteStatus {
  if (invite.revokedAt !== null) return 'REVOKED';
  if (invite.expiresAt <= now) return 'EXPIRED';
  if (invite.uses >= invite.maxUses) return 'USED_UP';
  return 'ACTIVE';
}

function toSpaceInvite(invite: InviteRecord, now: Date): SpaceInvite {
  return {
    id: invite.id,
    code: invite.code,
    role: inviteRoleSchema.parse(invite.role),
    expiresAt: invite.expiresAt.toISOString(),
    maxUses: invite.maxUses,
    uses: invite.uses,
    revokedAt: invite.revokedAt?.toISOString() ?? null,
    createdAt: invite.createdAt.toISOString(),
    status: inviteStatus(invite, now),
  };
}

const UNAVAILABLE_INVITE_ERRORS: Record<Exclude<InviteStatus, 'ACTIVE'>, [string, string]> = {
  REVOKED: ['INVITE_REVOKED', 'This invite code was revoked'],
  EXPIRED: ['INVITE_EXPIRED', 'This invite code has expired'],
  USED_UP: ['INVITE_USED_UP', 'This invite code has no uses left'],
};

/** 410 for an invite that exists but can no longer be used. */
function unavailableInvite(status: Exclude<InviteStatus, 'ACTIVE'>): AppError {
  const [code, message] = UNAVAILABLE_INVITE_ERRORS[status];
  return new AppError(code, message, 410);
}

const spaceArchived = () =>
  new AppError('SPACE_ARCHIVED', 'This Space is archived and does not accept members', 409);

export interface SpaceInvitesServiceDependencies {
  repository: SpaceInvitesRepository;
  spaces: SpacesRepository;
  settings: SettingsService;
}

export function createSpaceInvitesService({
  repository,
  spaces,
  settings,
}: SpaceInvitesServiceDependencies) {
  async function joinResult(
    spaceId: string,
    role: JoinSpaceResult['role'],
    alreadyMember: boolean,
  ): Promise<JoinSpaceResult> {
    const space = await spaces.findDetail(spaceId);
    if (space === null) throw new AppError('SPACE_NOT_FOUND', 'Space not found', 404);
    return { space: toSpace(space, role), role, alreadyMember };
  }

  return {
    /**
     * OWNERs create invite codes. Without expiresInHours or maxUses, the invite_default_*
     * settings apply. Inviting people shares the Space: a PRIVATE Space becomes MEMBERS.
     */
    async create(
      access: SpaceAccess,
      userId: string,
      body: CreateInviteBody,
    ): Promise<SpaceInvite> {
      if (access.archived) throw spaceArchived();
      const [ttlHours, maxUses, codeLength] = await Promise.all([
        body.expiresInHours ?? settings.getSetting('invite_default_ttl_hours'),
        body.maxUses ?? settings.getSetting('invite_default_max_uses'),
        settings.getSetting('invite_code_length'),
      ]);
      const now = new Date();
      const invite = {
        spaceId: access.spaceId,
        role: body.role,
        expiresAt: new Date(now.getTime() + ttlHours * MILLISECONDS_PER_HOUR),
        maxUses,
        createdById: userId,
      };

      for (let attempt = 1; ; attempt += 1) {
        try {
          const created = await repository.createInvite(
            { ...invite, code: generateInviteCode(codeLength) },
            { shareSpace: access.visibility === 'PRIVATE' },
          );
          return toSpaceInvite(created, now);
        } catch (error) {
          if (!isUniqueConstraintError(error) || attempt >= CODE_GENERATION_ATTEMPTS) throw error;
        }
      }
    },

    async list(access: SpaceAccess): Promise<SpaceInvite[]> {
      const now = new Date();
      return (await repository.listForSpace(access.spaceId)).map((invite) =>
        toSpaceInvite(invite, now),
      );
    },

    /** Revoking is idempotent. */
    async revoke(access: SpaceAccess, inviteId: string): Promise<void> {
      const invite = await repository.findInSpace(access.spaceId, inviteId);
      if (invite === null) throw new AppError('INVITE_NOT_FOUND', 'Invite not found', 404);
      await repository.revoke(invite.id, new Date());
    },

    /**
     * Joins the Space of a code with the invite's role. Members who use a code again keep their
     * role, and no use is spent.
     */
    async join(userId: string, code: string): Promise<JoinSpaceResult> {
      const invite = await repository.findByCode(code);
      if (invite === null) throw new AppError('INVITE_NOT_FOUND', 'Invalid invite code', 404);

      const member = await repository.findMemberRole(invite.spaceId, userId);
      if (member !== null) return joinResult(invite.spaceId, member.role, true);

      const now = new Date();
      const status = inviteStatus(invite, now);
      if (status !== 'ACTIVE') throw unavailableInvite(status);
      if (invite.space.archivedAt !== null) throw spaceArchived();
      if (invite.space.visibility === 'PRIVATE') {
        throw new AppError('SPACE_IS_PRIVATE', 'This Space is private again', 409);
      }

      try {
        const result = await repository.redeem(invite.id, invite.spaceId, userId, now);
        if (result.status === 'UNAVAILABLE') throw unavailableInvite('USED_UP');
        return await joinResult(invite.spaceId, result.role, result.status === 'ALREADY_MEMBER');
      } catch (error) {
        // The same user joined twice at the same time: the other request added the membership.
        if (!isUniqueConstraintError(error)) throw error;
        const joined = await repository.findMemberRole(invite.spaceId, userId);
        if (joined === null) throw error;
        return joinResult(invite.spaceId, joined.role, true);
      }
    },
  };
}

export type SpaceInvitesService = ReturnType<typeof createSpaceInvitesService>;
