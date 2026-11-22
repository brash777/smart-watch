import {
  spaceMetadataByModeSchema,
  type Space,
  type SpaceMode,
  type SpaceRole,
} from '@snapia/shared';
import type { AvatarUrlResolver } from '../users/avatars';
import { toUserSummary } from '../users/users.mappers';
import type { SpaceDetailRecord } from './spaces.repository';

/** The stored metadata of a Space, as a plain object of strings. */
function readMetadata(mode: SpaceMode, metadata: unknown): Record<string, string> {
  const parsed = spaceMetadataByModeSchema.safeParse({ mode, metadata });
  if (!parsed.success) return {};
  return Object.fromEntries(
    Object.entries(parsed.data.metadata).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

export async function toSpace(
  space: SpaceDetailRecord,
  myRole: SpaceRole | null,
  avatarUrl: AvatarUrlResolver,
): Promise<Space> {
  return {
    id: space.id,
    name: space.name,
    description: space.description,
    mode: space.mode,
    color: space.color,
    visibility: space.visibility,
    metadata: readMetadata(space.mode, space.metadata),
    coverSnapId: space.coverSnapId,
    archivedAt: space.archivedAt?.toISOString() ?? null,
    createdAt: space.createdAt.toISOString(),
    owner: await toUserSummary(space.owner, avatarUrl),
    counts: { snaps: space._count.snaps, members: space._count.members },
    myRole,
  };
}
