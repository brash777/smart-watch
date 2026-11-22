import type { FlashcardDeck, Quiz } from '@snapia/shared';
import type { DeckRecord, QuizRecord } from './study.repository';

export function toFlashcardDeck(deck: DeckRecord): FlashcardDeck {
  return {
    id: deck.id,
    spaceId: deck.spaceId,
    title: deck.title,
    promptVersion: deck.promptVersion,
    cards: deck.cards,
    createdAt: deck.createdAt.toISOString(),
  };
}

/** A quiz without its answers: the attempt reveals them. */
export function toQuiz(quiz: QuizRecord): Quiz {
  return {
    id: quiz.id,
    spaceId: quiz.spaceId,
    title: quiz.title,
    promptVersion: quiz.promptVersion,
    questions: quiz.questions.map(({ id, prompt, options, order, sourceSnapId }) => ({
      id,
      prompt,
      options,
      order,
      sourceSnapId,
    })),
    createdAt: quiz.createdAt.toISOString(),
  };
}
