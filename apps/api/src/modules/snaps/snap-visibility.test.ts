import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { addMember, createSpace, createUser } from '../../../test/factories';
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetTestDatabase,
} from '../../../test/test-database';
import type { StorageProvider } from '../../lib/storage';
import { createSnapImages } from './snap-images';
import { createSnapVisibility } from './snap-visibility';
import { createSnapVisibilityRepository } from './snap-visibility.repository';

const prisma = getTestPrisma();
const visibility = createSnapVisibility(createSnapVisibilityRepository(prisma));

beforeEach(resetTestDatabase);
afterAll(disconnectTestPrisma);

let sequence = 0;

async function snapIn(spaceId: string, authorId: string) {
  sequence += 1;
  return prisma.snap.create({
    data: {
      spaceId,
      authorId,
      storageKey: `spaces/${spaceId}/snaps/${String(sequence)}.webp`,
      thumbnailKey: `spaces/${spaceId}/snaps/${String(sequence)}-thumb.webp`,
      width: 10,
      height: 10,
      sizeBytes: 100,
      mimeType: 'image/webp',
    },
  });
}

/** ana owns a MEMBERS Space with max as a member; leo follows ana; sol is a stranger. */
async function scenario() {
  const ana = await createUser(prisma, { username: 'ana' });
  const max = await createUser(prisma, { username: 'max' });
  const leo = await createUser(prisma, { username: 'leo' });
  const sol = await createUser(prisma, { username: 'sol' });
  await prisma.follow.create({ data: { followerId: leo.id, followingId: ana.id } });
  const space = await createSpace(prisma, ana.id, { visibility: 'MEMBERS' });
  await addMember(prisma, space.id, max.id, 'VIEWER');
  const snap = await snapIn(space.id, ana.id);
  return { users: { ana, max, leo, sol }, space, snap };
}

async function post(authorId: string, snapId: string, visibility: 'PUBLIC' | 'FOLLOWERS') {
  return prisma.post.create({
    data: { authorId, caption: '', visibility, media: { create: { snapId, order: 1 } } },
  });
}

async function moment(
  authorId: string,
  snapId: string,
  audience: 'PUBLIC' | 'FOLLOWERS' | 'SPACE_MEMBERS',
  { spaceId = null as string | null, expiresInMs = 60_000 } = {},
) {
  return prisma.moment.create({
    data: { authorId, snapId, spaceId, audience, expiresAt: new Date(Date.now() + expiresInMs) },
  });
}

describe('canViewSnap', () => {
  it('blocks a stranger from a snap of a private Space', async () => {
    const { users, snap } = await scenario();
    const privateSpace = await createSpace(prisma, users.ana.id, { visibility: 'PRIVATE' });
    const privateSnap = await snapIn(privateSpace.id, users.ana.id);

    expect(await visibility.canViewSnap(users.sol.id, privateSnap.id)).toBe(false);
    expect(await visibility.canViewSnap(undefined, privateSnap.id)).toBe(false);
    expect(await visibility.canViewSnap(users.sol.id, snap.id)).toBe(false);
    expect(await visibility.canViewSnap(users.ana.id, privateSnap.id)).toBe(true);
  });

  it('lets the members of the Space view its snaps, and anyone in a PUBLIC Space', async () => {
    const { users, space, snap } = await scenario();

    expect(await visibility.canViewSnap(users.max.id, snap.id)).toBe(true);
    await prisma.space.update({ where: { id: space.id }, data: { visibility: 'PUBLIC' } });
    expect(await visibility.canViewSnap(users.sol.id, snap.id)).toBe(true);
    expect(await visibility.canViewSnap(undefined, snap.id)).toBe(true);
  });

  it('opens a snap through a Post that the user may see', async () => {
    const { users, snap } = await scenario();
    const forFollowers = await post(users.ana.id, snap.id, 'FOLLOWERS');

    expect(await visibility.canViewSnap(users.leo.id, snap.id)).toBe(true);
    expect(await visibility.canViewSnap(users.sol.id, snap.id)).toBe(false);

    await prisma.post.update({ where: { id: forFollowers.id }, data: { visibility: 'PUBLIC' } });
    expect(await visibility.canViewSnap(undefined, snap.id)).toBe(true);

    await prisma.post.update({ where: { id: forFollowers.id }, data: { hiddenAt: new Date() } });
    expect(await visibility.canViewSnap(users.sol.id, snap.id)).toBe(false);
  });

  it('opens a snap through an active Moment that the user may see', async () => {
    const { users, space, snap } = await scenario();
    const forFollowers = await moment(users.ana.id, snap.id, 'FOLLOWERS');

    expect(await visibility.canViewSnap(users.leo.id, snap.id)).toBe(true);
    expect(await visibility.canViewSnap(users.sol.id, snap.id)).toBe(false);

    await prisma.moment.update({
      where: { id: forFollowers.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await visibility.canViewSnap(users.leo.id, snap.id)).toBe(false);

    await moment(users.ana.id, snap.id, 'SPACE_MEMBERS', { spaceId: space.id });
    expect(await visibility.canViewSnap(users.leo.id, snap.id)).toBe(false);
    await moment(users.ana.id, snap.id, 'PUBLIC');
    expect(await visibility.canViewSnap(users.sol.id, snap.id)).toBe(true);
  });

  it('checks many snaps at once with the same rule', async () => {
    const { users, space, snap } = await scenario();
    const shared = await snapIn(space.id, users.ana.id);
    await post(users.ana.id, shared.id, 'PUBLIC');

    expect(await visibility.visibleSnapIds(users.sol.id, [snap.id, shared.id])).toEqual(
      new Set([shared.id]),
    );
    expect(await visibility.visibleSnapIds(users.sol.id, [])).toEqual(new Set());
  });
});

describe('snap image URLs', () => {
  it('are only signed for the snaps the viewer can view', async () => {
    const { users, space, snap } = await scenario();
    const shared = await snapIn(space.id, users.ana.id);
    await post(users.ana.id, shared.id, 'PUBLIC');
    const signed: string[] = [];
    const storage = {
      getSignedUrl: (key: string) => {
        signed.push(key);
        return Promise.resolve(`signed:${key}`);
      },
    } as unknown as StorageProvider;

    const urls = await createSnapImages({ storage, visibility }).signedUrls(users.sol.id, [
      snap,
      shared,
    ]);

    expect([...urls.keys()]).toEqual([shared.id]);
    expect(urls.get(shared.id)).toEqual({
      imageUrl: `signed:${shared.storageKey}`,
      thumbnailUrl: `signed:${shared.thumbnailKey}`,
    });
    expect(signed).not.toContain(snap.storageKey);
  });
});
