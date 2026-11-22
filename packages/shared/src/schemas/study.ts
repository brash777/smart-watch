import { z } from 'zod';
import { snapSelectionSchema } from './documents';

/*
 * Study tools of STUDY Spaces: a FlashcardDeck and a Quiz generated from analyzed snaps, and
 * quiz attempts scored by the API.
 */

const studyText = z.string().trim().min(1);
/** The snap a card or a question comes from, as numbered for the AI ([Snap N]). */
const sourceSnapNumber = z.number().int().min(1);

/** POST /api/spaces/:spaceId/flashcards and POST /api/spaces/:spaceId/quizzes */
export const generateStudyMaterialBodySchema = z.object({ snapIds: snapSelectionSchema });

/** What the AI writes for a FlashcardDeck. */
export const flashcardDeckDraftSchema = z.object({
  title: studyText,
  cards: z
    .array(z.object({ question: studyText, answer: studyText, sourceSnap: sourceSnapNumber }))
    .min(1),
});

/** What the AI writes for a Quiz: multiple-choice questions with their correct option. */
export const quizDraftSchema = z.object({
  title: studyText,
  questions: z
    .array(
      z
        .object({
          prompt: studyText,
          options: z.array(studyText).min(2),
          /** Index in options of the correct answer. */
          correctIndex: z.number().int().min(0),
          explanation: studyText,
          sourceSnap: sourceSnapNumber,
        })
        .refine((question) => question.correctIndex < question.options.length, {
          message: 'correctIndex must point to one of the options',
          path: ['correctIndex'],
        }),
    )
    .min(1),
});

/** A FlashcardDeck as the API returns it. */
export const flashcardDeckSchema = z.object({
  id: z.uuid(),
  spaceId: z.uuid(),
  title: z.string(),
  /** Prompt file that produced the deck, e.g. generate-flashcards.v1. */
  promptVersion: z.string(),
  cards: z.array(
    z.object({
      id: z.uuid(),
      question: z.string(),
      answer: z.string(),
      order: z.number().int().positive(),
      sourceSnapId: z.uuid().nullable(),
    }),
  ),
  createdAt: z.iso.datetime(),
});

/** A Quiz as the API returns it: without the correct answers, which the attempt reveals. */
export const quizSchema = z.object({
  id: z.uuid(),
  spaceId: z.uuid(),
  title: z.string(),
  /** Prompt file that produced the quiz, e.g. generate-quiz.v1. */
  promptVersion: z.string(),
  questions: z.array(
    z.object({
      id: z.uuid(),
      prompt: z.string(),
      options: z.array(z.string()),
      order: z.number().int().positive(),
      sourceSnapId: z.uuid().nullable(),
    }),
  ),
  createdAt: z.iso.datetime(),
});

/** POST /api/quizzes/:id/attempts: the chosen option of every question, in order. */
export const quizAttemptBodySchema = z.object({
  answers: z.array(z.number().int().min(0)).min(1),
});

/** The scored attempt, with the correct answers and their explanations. */
export const quizAttemptResultSchema = z.object({
  id: z.uuid(),
  quizId: z.uuid(),
  /** Correct answers. */
  score: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  results: z.array(
    z.object({
      questionId: z.uuid(),
      chosenIndex: z.number().int(),
      correctIndex: z.number().int(),
      isCorrect: z.boolean(),
      explanation: z.string().nullable(),
    }),
  ),
  createdAt: z.iso.datetime(),
});
