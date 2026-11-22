import type { PrismaClient } from '../../lib/prisma';

const messageSelect = {
  id: true,
  role: true,
  content: true,
  citedSnapIds: true,
  createdAt: true,
} as const;

export interface NewAnswer {
  content: string;
  citedSnapIds: string[];
  aiRunId: string;
  promptVersion: string;
}

export function createAskRepository(prisma: PrismaClient) {
  return {
    findSpace(spaceId: string) {
      return prisma.space.findUnique({
        where: { id: spaceId },
        select: { id: true, mode: true, metadata: true },
      });
    },

    /** The last messages of a user's conversation in a Space, the oldest first. */
    async recentMessages(spaceId: string, userId: string, limit: number) {
      const messages = await prisma.askMessage.findMany({
        where: { spaceId, userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: { role: true, content: true },
      });
      return messages.reverse();
    },

    /** The question and its answer, in one write. */
    saveExchange(spaceId: string, userId: string, question: string, answer: NewAnswer) {
      return prisma.$transaction([
        prisma.askMessage.create({
          data: { spaceId, userId, role: 'USER', content: question },
          select: messageSelect,
        }),
        prisma.askMessage.create({
          data: { spaceId, userId, role: 'ASSISTANT', ...answer },
          select: messageSelect,
        }),
      ]);
    },
  };
}

export type AskRepository = ReturnType<typeof createAskRepository>;
export type AskMessageRecord = Awaited<ReturnType<AskRepository['saveExchange']>>[number];
