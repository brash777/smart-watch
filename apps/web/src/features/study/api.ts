import {
  askExchangeSchema,
  flashcardDeckSchema,
  quizAttemptResultSchema,
  quizSchema,
  type AskExchange,
  type FlashcardDeck,
  type Quiz,
  type QuizAttemptResult,
} from '@snapia/shared';
import { apiRequest } from '../../lib/http';

export async function generateFlashcards(
  spaceId: string,
  snapIds: string[],
): Promise<FlashcardDeck> {
  return (
    await apiRequest(`/spaces/${spaceId}/flashcards`, flashcardDeckSchema, {
      method: 'POST',
      body: { snapIds },
    })
  ).data;
}

export async function generateQuiz(spaceId: string, snapIds: string[]): Promise<Quiz> {
  return (
    await apiRequest(`/spaces/${spaceId}/quizzes`, quizSchema, {
      method: 'POST',
      body: { snapIds },
    })
  ).data;
}

export async function submitQuizAttempt(
  quizId: string,
  answers: number[],
): Promise<QuizAttemptResult> {
  return (
    await apiRequest(`/quizzes/${quizId}/attempts`, quizAttemptResultSchema, {
      method: 'POST',
      body: { answers },
    })
  ).data;
}

export async function askSpace(spaceId: string, question: string): Promise<AskExchange> {
  return (
    await apiRequest(`/spaces/${spaceId}/ask`, askExchangeSchema, {
      method: 'POST',
      body: { question },
    })
  ).data;
}
