import {
  spaceMetadataByModeSchema,
  type CreateSpaceBody,
  type Space,
  type UpdateSpaceBody,
} from '@snapia/shared';
import { AppError } from '../../lib/app-error';
import { toPage, type Page } from '../../lib/pagination';
import type { SpaceAccess } from '../../middlewares/require-space-role';
import type { SettingsService } from '../settings/settings.service';
import { toSpace } from './spaces.mappers';
import type { SpaceListQuery, SpacesRepository } from './spaces.repository';

export interface SpacesServiceDependencies {
  repository: SpacesRepository;
  settings: SettingsService;
}

const spaceNotFound = () => new AppError('SPACE_NOT_FOUND', 'Space not found', 404);

export function createSpacesService({ repository, settings }: SpacesServiceDependencies) {
  /** The color of a Space must be one of the space_color_palette setting. */
  async function assertPaletteColor(color: string): Promise<void> {
    const palette = await settings.getSetting('space_color_palette');
    if (!palette.some((allowed) => allowed.toUpperCase() === color)) {
      throw new AppError('COLOR_NOT_IN_PALETTE', `${color} is not in the color palette`, 400, {
        palette,
      });
    }
  }

  async function findSpace(spaceId: string) {
    const space = await repository.findDetail(spaceId);
    if (space === null) throw spaceNotFound();
    return space;
  }

  return {
    /** Creates a Space; its creator becomes an OWNER member. */
    async create(userId: string, body: CreateSpaceBody): Promise<Space> {
      await assertPaletteColor(body.color);
      const space = await repository.createWithOwner({
        ownerId: userId,
        name: body.name,
        description: body.description ?? null,
        mode: body.mode,
        color: body.color,
        visibility: body.visibility,
        metadata: body.metadata,
      });
      return toSpace(space, 'OWNER');
    },

    /** The Spaces the user owns or joined. Archived ones only with archived=true. */
    async listMine(userId: string, query: SpaceListQuery): Promise<Page<Space>> {
      const rows = await repository.listForMember(userId, query);
      const { items, nextCursor } = toPage(rows, query.limit, ({ id }) => id);
      return {
        items: items.map((space) => toSpace(space, space.members[0]?.role ?? null)),
        nextCursor,
      };
    },

    async get(access: SpaceAccess): Promise<Space> {
      return toSpace(await findSpace(access.spaceId), access.memberRole);
    },

    /**
     * Changes a Space (OWNER). The mode never changes, and the metadata is validated against it.
     * A PRIVATE Space only has OWNERs, so it cannot become PRIVATE while it has other members.
     */
    async update(access: SpaceAccess, body: UpdateSpaceBody): Promise<Space> {
      const current = await findSpace(access.spaceId);
      if (body.color !== undefined) await assertPaletteColor(body.color);
      const metadata =
        body.metadata === undefined
          ? undefined
          : spaceMetadataByModeSchema.parse({ mode: current.mode, metadata: body.metadata })
              .metadata;
      if (
        body.visibility === 'PRIVATE' &&
        current.visibility !== 'PRIVATE' &&
        (await repository.countNonOwnerMembers(access.spaceId)) > 0
      ) {
        throw new AppError(
          'SPACE_HAS_MEMBERS',
          'Remove the members (or make them OWNERs) before making the Space private',
          409,
        );
      }
      const space = await repository.update(access.spaceId, {
        name: body.name,
        description: body.description,
        color: body.color,
        visibility: body.visibility,
        metadata,
      });
      return toSpace(space, access.memberRole);
    },

    /** Archived Spaces leave the main list and accept no new snaps, invites or members. */
    async setArchived(access: SpaceAccess, archived: boolean): Promise<Space> {
      const current = await findSpace(access.spaceId);
      if ((current.archivedAt !== null) === archived) return toSpace(current, access.memberRole);
      const space = await repository.setArchivedAt(access.spaceId, archived ? new Date() : null);
      return toSpace(space, access.memberRole);
    },
  };
}

export type SpacesService = ReturnType<typeof createSpacesService>;
