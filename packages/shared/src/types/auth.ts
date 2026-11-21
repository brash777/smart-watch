import type { z } from 'zod';
import type {
  authSessionSchema,
  loginBodySchema,
  meUserSchema,
  registerBodySchema,
  userSummarySchema,
} from '../schemas/auth';

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type UserSummary = z.infer<typeof userSummarySchema>;
export type MeUser = z.infer<typeof meUserSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
