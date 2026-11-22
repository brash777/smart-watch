import { type RequestHandler, Router } from 'express';
import type { RequireSpaceRole } from '../../middlewares/require-space-role';
import { validate } from '../../middlewares/validate';
import { createStudyController } from './study.controller';
import { studyInputs } from './study.schemas';
import type { StudyService } from './study.service';

export interface StudyRouterDependencies {
  service: StudyService;
  authenticate: RequestHandler;
  requireSpaceRole: RequireSpaceRole;
}

/** Mounted on /api/spaces: flashcards and quizzes of a STUDY Space. */
export function createSpaceStudyRouter(deps: StudyRouterDependencies): Router {
  const controller = createStudyController(deps.service);
  const router = Router();
  router.post(
    '/:spaceId/flashcards',
    deps.authenticate,
    deps.requireSpaceRole('EDITOR'),
    validate(studyInputs.generate),
    controller.generateFlashcards,
  );
  router.post(
    '/:spaceId/quizzes',
    deps.authenticate,
    deps.requireSpaceRole('EDITOR'),
    validate(studyInputs.generate),
    controller.generateQuiz,
  );
  return router;
}

/** /api/quizzes: attempts, scored by the API. */
export function createQuizzesRouter(deps: StudyRouterDependencies): Router {
  const controller = createStudyController(deps.service);
  const router = Router();
  router.post(
    '/:id/attempts',
    deps.authenticate,
    validate(studyInputs.attempt),
    controller.attempt,
  );
  return router;
}
