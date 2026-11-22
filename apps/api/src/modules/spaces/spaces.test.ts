import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  addMember,
  bearer,
  createDatabaseTestApp,
  createSpace,
  createUser,
  paletteColor,
  signIn,
} from '../../../test/factories';
import { readError } from '../../../test/http';
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetTestDatabase,
} from '../../../test/test-database';

const prisma = getTestPrisma();

const spaceResponseSchema = z.object({
  data: z
    .object({
      id: z.string(),
      name: z.string(),
      mode: z.string(),
      visibility: z.string(),
      metadata: z.record(z.string(), z.string()),
      myRole: z.string().nullable(),
      counts: z.object({ snaps: z.number(), members: z.number() }),
    })
    .loose(),
});

const spacePageSchema = z.object({
  data: z.array(spaceResponseSchema.shape.data),
  meta: z.object({ nextCursor: z.string().nullable() }),
});

beforeEach(resetTestDatabase);
afterAll(disconnectTestPrisma);

async function signedInUser(app: ReturnType<typeof createDatabaseTestApp>, username: string) {
  const user = await createUser(prisma, { username });
  const { accessToken } = await signIn(app, username);
  return { user, headers: bearer(accessToken) };
}

describe('POST /api/spaces', () => {
  it('creates a PRIVATE Space whose creator is its OWNER', async () => {
    const app = createDatabaseTestApp();
    const ana = await signedInUser(app, 'ana');

    const response = await request(app)
      .post('/api/spaces')
      .set(ana.headers)
      .send({
        name: 'Cálculo II',
        mode: 'STUDY',
        color: paletteColor().toLowerCase(),
        metadata: { subject: 'Cálculo II', professor: 'Prof. Test' },
      });

    expect(response.status).toBe(201);
    const { data } = spaceResponseSchema.parse(response.body);
    expect(data).toMatchObject({
      name: 'Cálculo II',
      mode: 'STUDY',
      visibility: 'PRIVATE',
      color: paletteColor(),
      metadata: { subject: 'Cálculo II', professor: 'Prof. Test' },
      myRole: 'OWNER',
      counts: { snaps: 0, members: 1 },
    });
    const member = await prisma.spaceMember.findFirstOrThrow({ where: { spaceId: data.id } });
    expect(member).toMatchObject({ userId: ana.user.id, role: 'OWNER' });
  });

  it('only accepts colors of the space_color_palette setting', async () => {
    const app = createDatabaseTestApp();
    const ana = await signedInUser(app, 'ana');

    const response = await request(app)
      .post('/api/spaces')
      .set(ana.headers)
      .send({ name: 'X', mode: 'WORK', color: '#123456' });

    expect(response.status).toBe(400);
    expect(readError(response.body).code).toBe('COLOR_NOT_IN_PALETTE');
  });

  it('validates the metadata against the mode and requires a session', async () => {
    const app = createDatabaseTestApp();
    const ana = await signedInUser(app, 'ana');

    const wrongMetadata = await request(app)
      .post('/api/spaces')
      .set(ana.headers)
      .send({ name: 'X', mode: 'WORK', color: paletteColor(), metadata: { niche: 'food' } });
    const anonymous = await request(app)
      .post('/api/spaces')
      .send({ name: 'X', mode: 'WORK', color: paletteColor() });

    expect(wrongMetadata.status).toBe(400);
    expect(readError(wrongMetadata.body).code).toBe('VALIDATION_ERROR');
    expect(anonymous.status).toBe(401);
  });
});

describe('GET /api/spaces', () => {
  it('lists the Spaces I own or joined, with counts and my role, and filters by mode', async () => {
    const app = createDatabaseTestApp();
    const ana = await signedInUser(app, 'ana');
    const leo = await createUser(prisma, { username: 'leo' });
    await createSpace(prisma, ana.user.id, { name: 'Mine', mode: 'STUDY' });
    const joined = await createSpace(prisma, leo.id, { name: 'Joined', mode: 'WORK' });
    await addMember(prisma, joined.id, ana.user.id, 'EDITOR');
    await createSpace(prisma, leo.id, { name: 'Not mine', mode: 'WORK' });

    const all = spacePageSchema.parse(
      (await request(app).get('/api/spaces').set(ana.headers)).body,
    );
    const work = spacePageSchema.parse(
      (await request(app).get('/api/spaces').query({ mode: 'WORK' }).set(ana.headers)).body,
    );

    expect(all.data.map(({ name, myRole }) => [name, myRole])).toEqual([
      ['Joined', 'EDITOR'],
      ['Mine', 'OWNER'],
    ]);
    expect(all.data[0]?.counts.members).toBe(2);
    expect(work.data.map(({ name }) => name)).toEqual(['Joined']);
  });

  it('hides archived Spaces unless archived=true', async () => {
    const app = createDatabaseTestApp();
    const ana = await signedInUser(app, 'ana');
    await createSpace(prisma, ana.user.id, { name: 'Active' });
    await createSpace(prisma, ana.user.id, { name: 'Old', archived: true });

    const active = spacePageSchema.parse(
      (await request(app).get('/api/spaces').set(ana.headers)).body,
    );
    const archived = spacePageSchema.parse(
      (await request(app).get('/api/spaces').query({ archived: 'true' }).set(ana.headers)).body,
    );

    expect(active.data.map(({ name }) => name)).toEqual(['Active']);
    expect(archived.data.map(({ name }) => name)).toEqual(['Old']);
  });
});

describe('GET /api/spaces/:spaceId', () => {
  it('lets members in and answers 403 to signed-in non-members of a PRIVATE Space', async () => {
    const app = createDatabaseTestApp();
    const ana = await signedInUser(app, 'ana');
    const leo = await signedInUser(app, 'leo');
    const space = await createSpace(prisma, ana.user.id);

    const owner = await request(app).get(`/api/spaces/${space.id}`).set(ana.headers);
    const stranger = await request(app).get(`/api/spaces/${space.id}`).set(leo.headers);
    const anonymous = await request(app).get(`/api/spaces/${space.id}`);

    expect(owner.status).toBe(200);
    expect(stranger.status).toBe(403);
    expect(readError(stranger.body).code).toBe('FORBIDDEN');
    expect(anonymous.status).toBe(401);
  });

  it('shows a PUBLIC Space to anyone, read-only and without a role', async () => {
    const app = createDatabaseTestApp();
    const ana = await createUser(prisma, { username: 'ana' });
    const leo = await signedInUser(app, 'leo');
    const space = await createSpace(prisma, ana.id, { visibility: 'PUBLIC' });

    const anonymous = await request(app).get(`/api/spaces/${space.id}`);
    const signedIn = await request(app).get(`/api/spaces/${space.id}`).set(leo.headers);
    const edit = await request(app)
      .patch(`/api/spaces/${space.id}`)
      .set(leo.headers)
      .send({ name: 'Hacked' });

    expect(anonymous.status).toBe(200);
    expect(spaceResponseSchema.parse(signedIn.body).data.myRole).toBeNull();
    expect(edit.status).toBe(403);
  });

  it('answers 404 for unknown or malformed ids', async () => {
    const app = createDatabaseTestApp();
    const ana = await signedInUser(app, 'ana');

    const unknown = await request(app)
      .get('/api/spaces/0196f3a2-0000-7000-8000-000000000000')
      .set(ana.headers);
    const malformed = await request(app).get('/api/spaces/not-a-uuid').set(ana.headers);

    expect(unknown.status).toBe(404);
    expect(readError(unknown.body).code).toBe('SPACE_NOT_FOUND');
    expect(malformed.status).toBe(404);
  });
});

describe('PATCH /api/spaces/:spaceId', () => {
  it('lets the OWNER change the Space, validating the metadata against its mode', async () => {
    const app = createDatabaseTestApp();
    const ana = await signedInUser(app, 'ana');
    const space = await createSpace(prisma, ana.user.id, { mode: 'WORK' });

    const ok = await request(app)
      .patch(`/api/spaces/${space.id}`)
      .set(ana.headers)
      .send({ name: 'Obra', color: paletteColor(1), metadata: { project: 'Bloque B' } });
    const wrongMode = await request(app)
      .patch(`/api/spaces/${space.id}`)
      .set(ana.headers)
      .send({ metadata: { subject: 'Física' } });

    expect(ok.status).toBe(200);
    expect(spaceResponseSchema.parse(ok.body).data).toMatchObject({
      name: 'Obra',
      metadata: { project: 'Bloque B' },
    });
    expect(wrongMode.status).toBe(400);
  });

  it('is only for OWNERs', async () => {
    const app = createDatabaseTestApp();
    const ana = await createUser(prisma, { username: 'ana' });
    const leo = await signedInUser(app, 'leo');
    const space = await createSpace(prisma, ana.id, { visibility: 'MEMBERS' });
    await addMember(prisma, space.id, leo.user.id, 'EDITOR');

    const response = await request(app)
      .patch(`/api/spaces/${space.id}`)
      .set(leo.headers)
      .send({ name: 'Mine now' });

    expect(response.status).toBe(403);
  });

  it('does not make a Space PRIVATE while it has members that are not OWNERs', async () => {
    const app = createDatabaseTestApp();
    const ana = await signedInUser(app, 'ana');
    const leo = await createUser(prisma, { username: 'leo' });
    const space = await createSpace(prisma, ana.user.id, { visibility: 'MEMBERS' });
    await addMember(prisma, space.id, leo.id, 'VIEWER');

    const response = await request(app)
      .patch(`/api/spaces/${space.id}`)
      .set(ana.headers)
      .send({ visibility: 'PRIVATE' });

    expect(response.status).toBe(409);
    expect(readError(response.body).code).toBe('SPACE_HAS_MEMBERS');
  });
});

describe('archive and unarchive', () => {
  it('archives and unarchives a Space (OWNER only)', async () => {
    const app = createDatabaseTestApp();
    const ana = await signedInUser(app, 'ana');
    const space = await createSpace(prisma, ana.user.id);

    const archived = await request(app).post(`/api/spaces/${space.id}/archive`).set(ana.headers);
    const again = await request(app).post(`/api/spaces/${space.id}/archive`).set(ana.headers);
    const restored = await request(app).post(`/api/spaces/${space.id}/unarchive`).set(ana.headers);

    expect(archived.status).toBe(200);
    expect(archived.body).toMatchObject({ data: { archivedAt: expect.any(String) as string } });
    expect(again.status).toBe(200);
    expect(restored.body).toMatchObject({ data: { archivedAt: null } });
  });
});
