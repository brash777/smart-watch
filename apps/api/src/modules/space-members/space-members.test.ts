import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  addMember,
  bearer,
  createDatabaseTestApp,
  createSpace,
  createUser,
  signIn,
} from '../../../test/factories';
import { readError } from '../../../test/http';
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetTestDatabase,
} from '../../../test/test-database';

const prisma = getTestPrisma();

const membersPageSchema = z.object({
  data: z.array(z.object({ user: z.object({ username: z.string() }).loose(), role: z.string() })),
  meta: z.object({ nextCursor: z.string().nullable() }),
});

beforeEach(resetTestDatabase);
afterAll(disconnectTestPrisma);

/** A MEMBERS Space owned by ana, with leo as EDITOR and sol as VIEWER. */
async function sharedSpace() {
  const app = createDatabaseTestApp();
  const ana = await createUser(prisma, { username: 'ana' });
  const leo = await createUser(prisma, { username: 'leo' });
  const sol = await createUser(prisma, { username: 'sol' });
  const space = await createSpace(prisma, ana.id, { visibility: 'MEMBERS' });
  await addMember(prisma, space.id, leo.id, 'EDITOR');
  await addMember(prisma, space.id, sol.id, 'VIEWER');
  const tokens = {
    ana: bearer((await signIn(app, 'ana')).accessToken),
    leo: bearer((await signIn(app, 'leo')).accessToken),
    sol: bearer((await signIn(app, 'sol')).accessToken),
  };
  return { app, space, users: { ana, leo, sol }, tokens };
}

describe('GET /api/spaces/:spaceId/members', () => {
  it('lists the members, OWNERs first, to anyone who can see the Space', async () => {
    const { app, space, tokens } = await sharedSpace();

    const response = await request(app).get(`/api/spaces/${space.id}/members`).set(tokens.sol);

    expect(response.status).toBe(200);
    const { data } = membersPageSchema.parse(response.body);
    expect(data.map(({ user, role }) => [user.username, role])).toEqual([
      ['ana', 'OWNER'],
      ['leo', 'EDITOR'],
      ['sol', 'VIEWER'],
    ]);
  });

  it('answers 403 to someone who is not a member', async () => {
    const { app, space } = await sharedSpace();
    await createUser(prisma, { username: 'out' });
    const outsider = bearer((await signIn(app, 'out')).accessToken);

    const response = await request(app).get(`/api/spaces/${space.id}/members`).set(outsider);

    expect(response.status).toBe(403);
  });
});

describe('PATCH /api/spaces/:spaceId/members/:userId', () => {
  it('lets OWNERs change roles, and nobody else', async () => {
    const { app, space, users, tokens } = await sharedSpace();

    const byOwner = await request(app)
      .patch(`/api/spaces/${space.id}/members/${users.sol.id}`)
      .set(tokens.ana)
      .send({ role: 'EDITOR' });
    const byEditor = await request(app)
      .patch(`/api/spaces/${space.id}/members/${users.sol.id}`)
      .set(tokens.leo)
      .send({ role: 'OWNER' });

    expect(byOwner.status).toBe(200);
    expect(byOwner.body).toMatchObject({ data: { user: { username: 'sol' }, role: 'EDITOR' } });
    expect(byEditor.status).toBe(403);
  });

  it('never leaves a Space without an OWNER and hands the Space over to another OWNER', async () => {
    const { app, space, users, tokens } = await sharedSpace();

    const lastOwner = await request(app)
      .patch(`/api/spaces/${space.id}/members/${users.ana.id}`)
      .set(tokens.ana)
      .send({ role: 'EDITOR' });
    expect(lastOwner.status).toBe(409);
    expect(readError(lastOwner.body).code).toBe('LAST_OWNER');

    await request(app)
      .patch(`/api/spaces/${space.id}/members/${users.leo.id}`)
      .set(tokens.ana)
      .send({ role: 'OWNER' })
      .expect(200);
    await request(app)
      .patch(`/api/spaces/${space.id}/members/${users.ana.id}`)
      .set(tokens.ana)
      .send({ role: 'VIEWER' })
      .expect(200);

    const updated = await prisma.space.findUniqueOrThrow({ where: { id: space.id } });
    expect(updated.ownerId).toBe(users.leo.id);
  });

  it('answers 404 for users who are not members', async () => {
    const { app, space, tokens } = await sharedSpace();
    const stranger = await createUser(prisma, { username: 'stranger' });

    const response = await request(app)
      .patch(`/api/spaces/${space.id}/members/${stranger.id}`)
      .set(tokens.ana)
      .send({ role: 'VIEWER' });

    expect(response.status).toBe(404);
    expect(readError(response.body).code).toBe('MEMBER_NOT_FOUND');
  });
});

describe('DELETE /api/spaces/:spaceId/members/:userId', () => {
  it('lets OWNERs remove members, who then lose access', async () => {
    const { app, space, users, tokens } = await sharedSpace();

    const removed = await request(app)
      .delete(`/api/spaces/${space.id}/members/${users.leo.id}`)
      .set(tokens.ana);
    const afterwards = await request(app).get(`/api/spaces/${space.id}`).set(tokens.leo);

    expect(removed.status).toBe(204);
    expect(afterwards.status).toBe(403);
  });

  it('does not remove the last OWNER', async () => {
    const { app, space, users, tokens } = await sharedSpace();

    const response = await request(app)
      .delete(`/api/spaces/${space.id}/members/${users.ana.id}`)
      .set(tokens.ana);

    expect(response.status).toBe(409);
  });
});

describe('POST /api/spaces/:spaceId/leave', () => {
  it('lets members leave, but not the last OWNER', async () => {
    const { app, space, tokens } = await sharedSpace();

    const editorLeaves = await request(app).post(`/api/spaces/${space.id}/leave`).set(tokens.leo);
    const ownerLeaves = await request(app).post(`/api/spaces/${space.id}/leave`).set(tokens.ana);

    expect(editorLeaves.status).toBe(204);
    expect(ownerLeaves.status).toBe(409);
    expect(readError(ownerLeaves.body).code).toBe('LAST_OWNER');
  });

  it('answers 409 NOT_A_MEMBER to visitors of a PUBLIC Space', async () => {
    const app = createDatabaseTestApp();
    const ana = await createUser(prisma, { username: 'ana' });
    await createUser(prisma, { username: 'visitor' });
    const space = await createSpace(prisma, ana.id, { visibility: 'PUBLIC' });
    const visitor = bearer((await signIn(app, 'visitor')).accessToken);

    const response = await request(app).post(`/api/spaces/${space.id}/leave`).set(visitor);

    expect(response.status).toBe(409);
    expect(readError(response.body).code).toBe('NOT_A_MEMBER');
  });
});
