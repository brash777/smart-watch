import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseAppSettingsSeed, readSeedFile, seedSettingValue } from '../../../prisma/seed-files';
import {
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
const settings = parseAppSettingsSeed(readSeedFile('app-settings.json'));
const HOUR_MS = 3_600_000;

const inviteSchema = z.object({
  data: z
    .object({
      id: z.string(),
      code: z.string(),
      role: z.string(),
      expiresAt: z.string(),
      maxUses: z.number(),
      uses: z.number(),
      status: z.string(),
    })
    .loose(),
});

beforeEach(resetTestDatabase);
afterAll(disconnectTestPrisma);

/** ana owns a PRIVATE STUDY Space; leo and sol are signed in but are not members. */
async function scenario() {
  const app = createDatabaseTestApp();
  const ana = await createUser(prisma, { username: 'ana' });
  await createUser(prisma, { username: 'leo' });
  await createUser(prisma, { username: 'sol' });
  const space = await createSpace(prisma, ana.id, { mode: 'STUDY' });
  const tokens = {
    ana: bearer((await signIn(app, 'ana')).accessToken),
    leo: bearer((await signIn(app, 'leo')).accessToken),
    sol: bearer((await signIn(app, 'sol')).accessToken),
  };
  async function createInvite(body: Record<string, unknown> = { role: 'EDITOR' }) {
    const response = await request(app)
      .post(`/api/spaces/${space.id}/invites`)
      .set(tokens.ana)
      .send(body);
    return inviteSchema.parse(response.body).data;
  }
  return { app, space, tokens, createInvite };
}

describe('POST /api/spaces/:spaceId/invites', () => {
  it('creates a code with the defaults of the settings and shares a PRIVATE Space', async () => {
    const { app, space, tokens } = await scenario();
    const before = Date.now();

    const response = await request(app)
      .post(`/api/spaces/${space.id}/invites`)
      .set(tokens.ana)
      .send({ role: 'EDITOR' });

    expect(response.status).toBe(201);
    const invite = inviteSchema.parse(response.body).data;
    expect(invite.code).toHaveLength(seedSettingValue(settings, 'invite_code_length'));
    expect(invite.code).toMatch(/^[A-HJKMNP-Z2-9]+$/);
    expect(invite.maxUses).toBe(seedSettingValue(settings, 'invite_default_max_uses'));
    const ttlMs = seedSettingValue(settings, 'invite_default_ttl_hours') * HOUR_MS;
    expect(Date.parse(invite.expiresAt) - before).toBeGreaterThanOrEqual(ttlMs - 60_000);
    expect(invite).toMatchObject({ role: 'EDITOR', uses: 0, status: 'ACTIVE' });

    const shared = await prisma.space.findUniqueOrThrow({ where: { id: space.id } });
    expect(shared.visibility).toBe('MEMBERS');
  });

  it('accepts a custom lifetime and number of uses, but never grants OWNER', async () => {
    const { app, space, tokens, createInvite } = await scenario();

    const custom = await createInvite({ role: 'VIEWER', expiresInHours: 2, maxUses: 3 });
    const owner = await request(app)
      .post(`/api/spaces/${space.id}/invites`)
      .set(tokens.ana)
      .send({ role: 'OWNER' });

    expect(custom).toMatchObject({ role: 'VIEWER', maxUses: 3 });
    expect(owner.status).toBe(400);
  });

  it('is only for OWNERs of Spaces that are not archived', async () => {
    const { app, space, tokens } = await scenario();
    const archived = await createSpace(
      prisma,
      (await prisma.user.findFirstOrThrow({ where: { username: 'ana' } })).id,
      {
        archived: true,
      },
    );

    const byStranger = await request(app)
      .post(`/api/spaces/${space.id}/invites`)
      .set(tokens.leo)
      .send({ role: 'EDITOR' });
    const inArchived = await request(app)
      .post(`/api/spaces/${archived.id}/invites`)
      .set(tokens.ana)
      .send({ role: 'EDITOR' });

    expect(byStranger.status).toBe(403);
    expect(inArchived.status).toBe(409);
    expect(readError(inArchived.body).code).toBe('SPACE_ARCHIVED');
  });
});

describe('listing and revoking invites', () => {
  it('lists the invites with their status and revokes them', async () => {
    const { app, space, tokens, createInvite } = await scenario();
    const invite = await createInvite();

    const revoke = await request(app)
      .delete(`/api/spaces/${space.id}/invites/${invite.id}`)
      .set(tokens.ana);
    const list = await request(app).get(`/api/spaces/${space.id}/invites`).set(tokens.ana);
    const join = await request(app)
      .post('/api/spaces/join')
      .set(tokens.leo)
      .send({ code: invite.code });

    expect(revoke.status).toBe(204);
    expect(list.body).toMatchObject({ data: [{ id: invite.id, status: 'REVOKED' }] });
    expect(join.status).toBe(410);
    expect(readError(join.body).code).toBe('INVITE_REVOKED');
  });
});

describe('POST /api/spaces/join', () => {
  it('adds the user with the role of the invite and spends one use', async () => {
    const { app, space, tokens, createInvite } = await scenario();
    const invite = await createInvite({ role: 'EDITOR' });
    const typedCode = `${invite.code.slice(0, 4).toLowerCase()}-${invite.code.slice(4)} `;

    const response = await request(app)
      .post('/api/spaces/join')
      .set(tokens.leo)
      .send({ code: typedCode });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: { space: { id: space.id, myRole: 'EDITOR' }, role: 'EDITOR', alreadyMember: false },
    });
    const stored = await prisma.spaceInvite.findUniqueOrThrow({ where: { id: invite.id } });
    expect(stored.uses).toBe(1);
    await request(app).get(`/api/spaces/${space.id}`).set(tokens.leo).expect(200);
  });

  it('does not duplicate members nor spend uses when a member joins again', async () => {
    const { app, space, tokens, createInvite } = await scenario();
    const invite = await createInvite();
    await request(app).post('/api/spaces/join').set(tokens.leo).send({ code: invite.code });

    const again = await request(app)
      .post('/api/spaces/join')
      .set(tokens.leo)
      .send({ code: invite.code });

    expect(again.body).toMatchObject({ data: { alreadyMember: true, role: 'EDITOR' } });
    expect(await prisma.spaceMember.count({ where: { spaceId: space.id } })).toBe(2);
    const stored = await prisma.spaceInvite.findUniqueOrThrow({ where: { id: invite.id } });
    expect(stored.uses).toBe(1);
  });

  it('rejects used-up, expired and unknown codes', async () => {
    const { app, tokens, createInvite } = await scenario();
    const single = await createInvite({ role: 'VIEWER', maxUses: 1 });
    const expiring = await createInvite();
    await prisma.spaceInvite.update({
      where: { id: expiring.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await request(app).post('/api/spaces/join').set(tokens.leo).send({ code: single.code });
    const usedUp = await request(app)
      .post('/api/spaces/join')
      .set(tokens.sol)
      .send({ code: single.code });
    const expired = await request(app)
      .post('/api/spaces/join')
      .set(tokens.sol)
      .send({ code: expiring.code });
    const unknown = await request(app)
      .post('/api/spaces/join')
      .set(tokens.sol)
      .send({ code: 'NOPE2345' });

    expect(readError(usedUp.body).code).toBe('INVITE_USED_UP');
    expect(usedUp.status).toBe(410);
    expect(readError(expired.body).code).toBe('INVITE_EXPIRED');
    expect(unknown.status).toBe(404);
  });

  it('does not let people join a Space that became PRIVATE again or was archived', async () => {
    const { app, space, tokens, createInvite } = await scenario();
    const invite = await createInvite();
    await prisma.space.update({ where: { id: space.id }, data: { visibility: 'PRIVATE' } });

    const privateAgain = await request(app)
      .post('/api/spaces/join')
      .set(tokens.leo)
      .send({ code: invite.code });
    await prisma.space.update({
      where: { id: space.id },
      data: { visibility: 'MEMBERS', archivedAt: new Date() },
    });
    const archived = await request(app)
      .post('/api/spaces/join')
      .set(tokens.leo)
      .send({ code: invite.code });

    expect(readError(privateAgain.body).code).toBe('SPACE_IS_PRIVATE');
    expect(readError(archived.body).code).toBe('SPACE_ARCHIVED');
  });
});
