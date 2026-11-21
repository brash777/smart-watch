import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { z } from 'zod';

export const REQUEST_ID_HEADER = 'X-Request-Id';

const incomingRequestIdSchema = z.uuid();

/**
 * Gives every request an id: reuses a valid incoming X-Request-Id (a UUID) or creates one.
 * The id is stored in req.id (used by the logger) and echoed in the response header.
 */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = incomingRequestIdSchema.safeParse(req.get(REQUEST_ID_HEADER));
  const id = incoming.success ? incoming.data : randomUUID();
  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
};
