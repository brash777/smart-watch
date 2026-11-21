import { z } from 'zod';
import { userRoleSchema } from './enums';

/** Usernames that would collide with API routes (/users/me, /users/search). */
const RESERVED_USERNAMES: ReadonlySet<string> = new Set(['me', 'search']);

/** bcrypt only uses the first 72 bytes of a password. */
const BCRYPT_MAX_PASSWORD_BYTES = 72;

/** Length of a string in UTF-8 bytes. */
function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/**
 * Username: 3 to 30 characters among lowercase letters, digits, dots and underscores.
 * It cannot start or end with a dot nor contain two dots in a row. Input is trimmed and lowercased.
 */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'must have at least 3 characters')
  .max(30, 'must have at most 30 characters')
  .regex(
    /^[a-z0-9_](?:[a-z0-9_.]*[a-z0-9_])?$/,
    'may only contain lowercase letters, digits, dots and underscores, and cannot start or end with a dot',
  )
  .refine((value) => !value.includes('..'), 'cannot contain two dots in a row')
  .refine((value) => !RESERVED_USERNAMES.has(value), 'is reserved');

/** Password policy: at least 8 characters with at least one letter and one digit. */
export const passwordSchema = z
  .string()
  .min(8, 'must have at least 8 characters')
  .refine(
    (value) => utf8ByteLength(value) <= BCRYPT_MAX_PASSWORD_BYTES,
    `must have at most ${BCRYPT_MAX_PASSWORD_BYTES} bytes`,
  )
  .refine((value) => /\p{L}/u.test(value), 'must contain a letter')
  .refine((value) => /\p{N}/u.test(value), 'must contain a digit');

/** Email address, trimmed and lowercased. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'must be a valid email address' }));

/** Display name of a person. */
export const personNameSchema = z.string().trim().min(1, 'is required');

/** POST /api/auth/register */
export const registerBodySchema = z.object({
  name: personNameSchema,
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

/** POST /api/auth/login: identifier is an email or a username. */
export const loginBodySchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1, 'is required'),
  password: z.string().min(1, 'is required'),
});

/** A user as shown in lists (search, followers, following). */
export const userSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  username: z.string(),
  /** Null until the user uploads a profile photo. */
  avatarUrl: z.string().nullable(),
});

/** The signed-in user (GET /api/auth/me). Only its owner sees the email. */
export const meUserSchema = userSummarySchema.extend({
  email: z.string(),
  role: userRoleSchema,
  bio: z.string().nullable(),
  university: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

/** Response of register, login and refresh. The refresh token travels in an httpOnly cookie. */
export const authSessionSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal('Bearer'),
  /** Seconds until the access token expires. */
  expiresIn: z.number().int().positive(),
  user: meUserSchema,
});
