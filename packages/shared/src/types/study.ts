import type { z } from 'zod';
import type {
  flashcardDeckDraftSchema,
  flashcardDeckSchema,
  generateStudyMaterialBodySchema,
  quizAttemptBodySchema,
  quizAttemptResultSchema,
  quizDraftSchema,
  quizSchema,
} from '../schemas/study';

export type GenerateStudyMaterialBody = z.infer<typeof generateStudyMaterialBodySchema>;
export type FlashcardDeckDraft = z.infer<typeof flashcardDeckDraftSchema>;
export type QuizDraft = z.infer<typeof quizDraftSchema>;
export type FlashcardDeck = z.infer<typeof flashcardDeckSchema>;
export type Quiz = z.infer<typeof quizSchema>;
export type QuizAttemptBody = z.infer<typeof quizAttemptBodySchema>;
export type QuizAttemptResult = z.infer<typeof quizAttemptResultSchema>;
