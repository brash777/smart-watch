import type { CreateMomentBody, Moment, MomentGroup } from '@snapia/shared';
import { AppError } from '../../lib/app-error';
import type { SettingsService } from '../settings/settings.service';
import type { SnapImages } from '../snaps/snap-images';
import type { SnapSharing } from '../social/snap-sharing';
import type { AvatarUrlResolver } from '../users/avatars';
import { groupByAuthor, toMoment } from './moments.mappers';
import type { MomentRecord, MomentsRepository } from './moments.repository';

const MS_PER_HOUR = 3_600_000;

export interface MomentsServiceDependencies {
  repository: MomentsRepository;
  sharing: SnapSharing;
  settings: SettingsService;
  /** Signs the photo URLs of the snaps the viewer can view (canViewSnap). */
  snapImages: SnapImages;
  avatarUrl: AvatarUrlResolver;
}

export function createMomentsService({
  repository,
  sharing,
  settings,
  snapImages,
  avatarUrl,
}: MomentsServiceDependencies) {
  /** The Moments the viewer can see the photo of. */
  async function present(viewerId: string, moments: MomentRecord[]): Promise<Moment[]> {
    const urls = await snapImages.signedUrls(
      viewerId,
      moments.map(({ snap }) => snap),
    );
    const shown = await Promise.all(
      moments.map((moment) => toMoment(moment, viewerId, urls, avatarUrl)),
    );
    return shown.filter((moment) => moment !== null);
  }

  return {
    /**
     * Shares a snap as a Moment until moment_ttl_hours from now. Only its author shares it;
     * SPACE_MEMBERS shows it to the members of the snap's Space.
     */
    async create(userId: string, { snapId, audience }: CreateMomentBody): Promise<Moment> {
      const [snap] = await sharing.snapsToShare(userId, [snapId]);
      if (snap === undefined) throw new AppError('SNAP_NOT_FOUND', 'Snap not found', 404);
      const ttlHours = await settings.getSetting('moment_ttl_hours');
      const moment = await repository.create({
        authorId: userId,
        snapId: snap.id,
        spaceId: audience === 'SPACE_MEMBERS' ? snap.spaceId : null,
        audience,
        expiresAt: new Date(Date.now() + ttlHours * MS_PER_HOUR),
      });
      const [shared] = await present(userId, [moment]);
      if (shared === undefined) throw new Error('The author cannot view the shared snap');
      return shared;
    },

    /** The active Moments of the people the user follows and the user's own, by author. */
    async feed(userId: string): Promise<MomentGroup[]> {
      const moments = await repository.listFeed(userId, new Date());
      return groupByAuthor(await present(userId, moments), userId);
    },

    /** Marks a Moment as seen (once per person; the author's own views do not count). */
    async view(momentId: string, userId: string): Promise<void> {
      const now = new Date();
      const moment = await repository.findActive(momentId, now);
      if (moment === null) {
        throw new AppError('MOMENT_NOT_FOUND', 'Moment not found or expired', 404);
      }
      if (!(await repository.isVisible(momentId, userId, now))) {
        throw new AppError('FORBIDDEN', 'This Moment is not shared with you', 403);
      }
      if (moment.authorId !== userId) await repository.addView(momentId, userId);
    },
  };
}

export type MomentsService = ReturnType<typeof createMomentsService>;
