import type { PrismaClient } from '../../lib/prisma';

const deckSelect = {
  id: true,
  spaceId: true,
  title: true,
  promptVersion: true,
  createdAt: true,
  cards: {
    select: { id: true, question: true, answer: true, order: true, sourceSnapId: true },
    orderBy: { order: 'asc' },
  },
} as const;

const quizSelect = {
  id: true,
  spaceId: true,
  title: true,
  promptVersion: true,
  createdAt: true,
  questions: {
    select: {
      id: true,
      prompt: true,
      options: true,
      correctIndex: true,
      explanation: true,
      order: true,
      sourceSnapId: true,
    },
    orderBy: { order: 'asc' },
  },
} as const;

interface NewStudyMaterial {
  spaceId: string;
  authorId: string;
  title: string;
  promptVersion: string;
}

export interface NewDeck extends NewStudyMaterial {
  cards: { question: string; answer: string; sourceSnapId: string | null }[];
}

export interface NewQuiz extends NewStudyMaterial {
  questions: {
    prompt: string;
    options: string[];
    correctIndex: number;
    explanation: string | null;
    sourceSnapId: string | null;
  }[];
}

export function createStudyRepository(prisma: PrismaClient) {
  return {
    /** What the study tools need to know about the Space. */
    findSpace(spaceId: string) {
      return prisma.space.findUnique({
        where: { id: spaceId },
        select: { id: true, mode: true, metadata: true },
      });
    },

    createDeck({ cards, ...deck }: NewDeck) {
      return prisma.flashcardDeck.create({
        data: {
          ...deck,
          cards: { create: cards.map((card, index) => ({ ...card, order: index + 1 })) },
        },
        select: deckSelect,
      });
    },

    createQuiz({ questions, ...quiz }: NewQuiz) {
      return prisma.quiz.create({
        data: {
          ...quiz,
          questions: {
            create: questions.map((question, index) => ({ ...question, order: index + 1 })),
          },
        },
        select: quizSelect,
      });
    },

    /** The quiz with its correct answers. */
    findQuiz(id: string) {
      return prisma.quiz.findUnique({ where: { id }, select: quizSelect });
    },

    createAttempt(attempt: { quizId: string; userId: string; answers: number[]; score: number }) {
      return prisma.quizAttempt.create({ data: attempt, select: { id: true, createdAt: true } });
    },
  };
}

export type StudyRepository = ReturnType<typeof createStudyRepository>;
export type DeckRecord = Awaited<ReturnType<StudyRepository['createDeck']>>;
export type QuizRecord = NonNullable<Awaited<ReturnType<StudyRepository['findQuiz']>>>;
