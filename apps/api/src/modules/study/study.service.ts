import type {
  FlashcardDeck,
  GenerateStudyMaterialBody,
  Quiz,
  QuizAttemptBody,
  QuizAttemptResult,
} from '@snapia/shared';
import { AppError } from '../../lib/app-error';
import type { SpaceAccess } from '../../middlewares/require-space-role';
import type { AnalyzedSnap } from '../ai/snap-context';
import type { StudyMaterialTasks } from '../ai/tasks/study-material';
import type { SnapSelection } from '../snap-insights/snap-selection';
import type { SpaceContentPermissions } from '../spaces/space-content-permissions';
import { toFlashcardDeck, toQuiz } from './study.mappers';
import type { StudyRepository } from './study.repository';

export interface StudyServiceDependencies {
  repository: StudyRepository;
  snapSelection: SnapSelection;
  tasks: StudyMaterialTasks;
  permissions: SpaceContentPermissions;
}

/** The id of the snap a card or a question cites as [Snap N]. */
function sourceSnapId(snaps: readonly AnalyzedSnap[], sourceSnap: number): string | null {
  return snaps[sourceSnap - 1]?.id ?? null;
}

export function createStudyService({
  repository,
  snapSelection,
  tasks,
  permissions,
}: StudyServiceDependencies) {
  /** The Space of a study tool: it must be a STUDY Space. Then the selected snaps. */
  async function prepare(access: SpaceAccess, snapIds: readonly string[]) {
    const space = await repository.findSpace(access.spaceId);
    if (space === null) throw new AppError('SPACE_NOT_FOUND', 'Space not found', 404);
    if (space.mode !== 'STUDY') {
      throw new AppError(
        'STUDY_SPACE_REQUIRED',
        'Flashcards and quizzes are for STUDY Spaces',
        400,
        {
          mode: space.mode,
        },
      );
    }
    return { space, snaps: await snapSelection.select(space.id, snapIds) };
  }

  return {
    /** A FlashcardDeck from analyzed snaps (EDITOR or OWNER of a STUDY Space). */
    async generateFlashcards(
      access: SpaceAccess,
      authorId: string,
      { snapIds }: GenerateStudyMaterialBody,
    ): Promise<FlashcardDeck> {
      const { space, snaps } = await prepare(access, snapIds);
      const deck = await tasks.generateFlashcards({ space, snaps, userId: authorId });
      const stored = await repository.createDeck({
        spaceId: space.id,
        authorId,
        title: deck.title,
        promptVersion: deck.promptVersion,
        cards: deck.cards.map(({ question, answer, sourceSnap }) => ({
          question,
          answer,
          sourceSnapId: sourceSnapId(snaps, sourceSnap),
        })),
      });
      return toFlashcardDeck(stored);
    },

    /** A Quiz from analyzed snaps (EDITOR or OWNER of a STUDY Space), without its answers. */
    async generateQuiz(
      access: SpaceAccess,
      authorId: string,
      { snapIds }: GenerateStudyMaterialBody,
    ): Promise<Quiz> {
      const { space, snaps } = await prepare(access, snapIds);
      const quiz = await tasks.generateQuiz({ space, snaps, userId: authorId });
      const stored = await repository.createQuiz({
        spaceId: space.id,
        authorId,
        title: quiz.title,
        promptVersion: quiz.promptVersion,
        questions: quiz.questions.map(({ sourceSnap, ...question }) => ({
          ...question,
          sourceSnapId: sourceSnapId(snaps, sourceSnap),
        })),
      });
      return toQuiz(stored);
    },

    /**
     * Scores an attempt on the server: the client only sends the chosen options, one per
     * question in order. Anyone who can see the quiz's Space can try it.
     */
    async attempt(
      quizId: string,
      userId: string,
      { answers }: QuizAttemptBody,
    ): Promise<QuizAttemptResult> {
      const quiz = await repository.findQuiz(quizId);
      if (quiz === null) throw new AppError('QUIZ_NOT_FOUND', 'Quiz not found', 404);
      await permissions.memberRoleIn(quiz.spaceId, userId);

      const { questions } = quiz;
      if (answers.length !== questions.length) {
        throw new AppError('INVALID_ANSWERS', 'Send one answer per question', 400, {
          expected: questions.length,
        });
      }
      const outOfRange = questions.findIndex(
        (question, index) => (answers[index] ?? 0) >= question.options.length,
      );
      if (outOfRange !== -1) {
        throw new AppError('INVALID_ANSWERS', 'An answer is not one of the options', 400, {
          question: outOfRange,
        });
      }

      const results = questions.map((question, index) => {
        const chosenIndex = answers[index] ?? -1;
        return {
          questionId: question.id,
          chosenIndex,
          correctIndex: question.correctIndex,
          isCorrect: chosenIndex === question.correctIndex,
          explanation: question.explanation,
        };
      });
      const score = results.filter(({ isCorrect }) => isCorrect).length;
      const attempt = await repository.createAttempt({ quizId: quiz.id, userId, answers, score });
      return {
        id: attempt.id,
        quizId: quiz.id,
        score,
        total: questions.length,
        results,
        createdAt: attempt.createdAt.toISOString(),
      };
    },
  };
}

export type StudyService = ReturnType<typeof createStudyService>;
