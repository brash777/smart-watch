import type { RequestHandler } from 'express';
import { requireAuth } from '../../middlewares/authenticate';
import { requireSpaceAccess } from '../../middlewares/require-space-role';
import { getValidatedInput } from '../../middlewares/validate';
import { askInputs } from './ask.schemas';
import type { AskService } from './ask.service';

export function createAskController(service: AskService) {
  const ask: RequestHandler = async (req, res) => {
    const { body } = getValidatedInput(res, askInputs.ask);
    const exchange = await service.ask(requireSpaceAccess(req), requireAuth(req).userId, body);
    res.status(201).json({ data: exchange });
  };

  return { ask };
}
