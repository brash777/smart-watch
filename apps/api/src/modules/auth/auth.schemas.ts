import { loginBodySchema, registerBodySchema } from '@snapia/shared';
import type { RequestSchemas } from '../../middlewares/validate';

export const registerInput = { body: registerBodySchema } satisfies RequestSchemas;

export const loginInput = { body: loginBodySchema } satisfies RequestSchemas;
