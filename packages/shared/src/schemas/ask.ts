import { z } from 'zod';

/** Who wrote an AskMessage. */
export const askMessageRoleSchema = z.enum(['USER', 'ASSISTANT']);

/** POST /api/spaces/:spaceId/ask */
export const askBodySchema = z.object({ question: z.string().trim().min(1) });

/** What the AI writes: an answer that cites the snaps as [Snap N]. */
export const askAnswerDraftSchema = z.object({
  answer: z.string().trim().min(1),
  /** False when the snaps do not contain the answer (and the answer says so). */
  found: z.boolean(),
});

/** A message of the "Ask your Space" chat. */
export const askMessageSchema = z.object({
  id: z.uuid(),
  role: askMessageRoleSchema,
  content: z.string(),
  /** The snaps an ASSISTANT answer cites. */
  citedSnapIds: z.array(z.uuid()),
  createdAt: z.iso.datetime(),
});

/** The question and its answer. */
export const askExchangeSchema = z.object({
  question: askMessageSchema,
  answer: askMessageSchema,
  found: z.boolean(),
});
