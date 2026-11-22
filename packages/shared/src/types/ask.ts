import type { z } from 'zod';
import type {
  askAnswerDraftSchema,
  askBodySchema,
  askExchangeSchema,
  askMessageRoleSchema,
  askMessageSchema,
} from '../schemas/ask';

export type AskMessageRole = z.infer<typeof askMessageRoleSchema>;
export type AskBody = z.infer<typeof askBodySchema>;
export type AskAnswerDraft = z.infer<typeof askAnswerDraftSchema>;
export type AskMessage = z.infer<typeof askMessageSchema>;
export type AskExchange = z.infer<typeof askExchangeSchema>;
