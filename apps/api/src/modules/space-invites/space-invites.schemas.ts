import { createInviteBodySchema, joinSpaceBodySchema } from '@snapia/shared';
import { z } from 'zod';
import type { RequestSchemas } from '../../middlewares/validate';

export const createInviteInput = { body: createInviteBodySchema } satisfies RequestSchemas;

export const revokeInviteInput = {
  params: z.object({ spaceId: z.uuid(), inviteId: z.uuid() }),
} satisfies RequestSchemas;

export const joinSpaceInput = { body: joinSpaceBodySchema } satisfies RequestSchemas;
