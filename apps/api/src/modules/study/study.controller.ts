import type { RequestHandler } from 'express';
import { requireAuth } from '../../middlewares/authenticate';
import { requireSpaceAccess } from '../../middlewares/require-space-role';
import { getValidatedInput } from '../../middlewares/validate';
import { studyInputs } from './study.schemas';
import type { StudyService } from './study.service';

export function createStudyController(service: StudyService) {
  const generateFlashcards: RequestHandler = async (req, res) => {
    const { body } = getValidatedInput(res, studyInputs.generate);
    const deck = await service.generateFlashcards(
      requireSpaceAccess(req),
      requireAuth(req).userId,
      body,
    );
    res.status(201).json({ data: deck });
  };

  const generateQuiz: RequestHandler = async (req, res) => {
    const { body } = getValidatedInput(res, studyInputs.generate);
    const quiz = await service.generateQuiz(requireSpaceAccess(req), requireAuth(req).userId, body);
    res.status(201).json({ data: quiz });
  };

  const attempt: RequestHandler = async (req, res) => {
    const { params, body } = getValidatedInput(res, studyInputs.attempt);
    res.status(201).json({ data: await service.attempt(params.id, requireAuth(req).userId, body) });
  };

  return { generateFlashcards, generateQuiz, attempt };
}
