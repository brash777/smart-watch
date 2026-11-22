import {
  spaceMetadataByModeSchema,
  type Space,
  type SpaceMode,
  type SpaceRole,
} from '@snapia/shared';
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

export function toSpace(space: SpaceDetailRecord, myRole: SpaceRole | null): Space {
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
    owner: toUserSummary(space.owner),
    counts: { snaps: space._count.snaps, members: space._count.members },
    myRole,
  };
}
